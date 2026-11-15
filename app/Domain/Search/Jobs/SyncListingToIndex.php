<?php

declare(strict_types=1);

namespace App\Domain\Search\Jobs;

use App\Domain\Listings\Models\Listing;
use App\Domain\Search\ListingDocument;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;

/**
 * Приводит документ объявления в индексе в соответствие с БД: published — записать, иначе (или строки нет) — убрать.
 * Решает по состоянию на момент выполнения, а не по событию, поэтому порядок доставки и повторы безвредны.
 * Ставится в очередь без задержки: объявление уходит из выдачи за секунды, окно — не больше 60 с (ARCHITECTURE §5).
 */
final class SyncListingToIndex implements ShouldQueue
{
    use Dispatchable;
    use Queueable;

    public function __construct(public readonly string $listingId) {}

    /**
     * release() занятого замка WithoutOverlapping (пауза 2 с) считается попыткой, поэтому попыток с запасом,
     * чтобы событие не терялось до ночной сверки. Время (retryUntil) для этого не годится: оно считается от
     * постановки в очередь, и задание, простоявшее больше минуты, упало бы без единой попытки.
     */
    public int $tries = 30;

    /** Падения по исключениям (не по замку) ограничены отдельно; паузы между ними — backoff(). */
    public int $maxExceptions = 4;

    /** @return list<int> */
    public function backoff(): array
    {
        return [2, 5, 10, 20];
    }

    /**
     * Задачи одного объявления идут по очереди: без этого «публикация» читает строку, «снятие» удаляет документ,
     * и только потом «публикация» пишет устаревший документ. Вторая задача не отбрасывается (в отличие от
     * ShouldBeUnique), а возвращается в очередь; замок не вечный — упавший воркер его не удержит.
     *
     * @return list<WithoutOverlapping>
     */
    public function middleware(): array
    {
        return [(new WithoutOverlapping($this->listingId))->releaseAfter(2)->expireAfter(60)];
    }

    public function handle(): void
    {
        $listing = Listing::query()
            ->with(ListingDocument::RELATIONS)
            ->find($this->listingId);
        $engine = (new Listing)->searchableUsing();

        if ($listing !== null && $listing->shouldBeSearchable()) {
            $engine->update(new Collection([$listing]));

            return;
        }

        // Ключ нужен движку, а не содержимое: строки в БД может уже не быть.
        $ghost = $listing ?? (new Listing)->forceFill(['id' => $this->listingId]);
        $engine->delete(new Collection([$ghost]));
    }
}
