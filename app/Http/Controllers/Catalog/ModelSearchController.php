<?php

declare(strict_types=1);

namespace App\Http\Controllers\Catalog;

use App\Domain\Catalog\Enums\InstrumentModelStatus;
use App\Domain\Catalog\Models\InstrumentModel;
use App\Domain\Catalog\Queries\CategoryTree;
use App\Http\Controllers\Controller;
use App\Http\Resources\Catalog\InstrumentModelResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Throwable;

/** GET /api/models?q= — подсказка модели в форме «Продать» (UC-L1, п. 2). Публично, без входа. */
final class ModelSearchController extends Controller
{
    private const LIMIT = 8;

    /** Запас по выборке из индекса: устаревшие документы (скрытые модели) не съедают слоты подсказки. */
    private const OVERFETCH = 3;

    private const MIN_QUERY_LENGTH = 2;

    private const MAX_QUERY_LENGTH = 100;

    public function __invoke(Request $request): AnonymousResourceCollection
    {
        $request->validate(['q' => ['nullable', 'string', 'max:'.self::MAX_QUERY_LENGTH]]);

        $query = $request->string('q')->trim()->toString();
        if (mb_strlen($query) < self::MIN_QUERY_LENGTH) {
            return InstrumentModelResource::collection(collect());
        }

        try {
            $models = $this->search($query);
        } catch (Throwable $exception) {
            // Подсказка — не обязательный шаг: без поиска продавец вводит модель текстом.
            Log::warning('Подсказка моделей: поиск недоступен', ['exception' => $exception::class, 'message' => $exception->getMessage()]);
            $models = collect();
        }

        return InstrumentModelResource::collection($models);
    }

    /** @return Collection<int, InstrumentModel> */
    private function search(string $query): Collection
    {
        // Индекс отдаёт порядок релевантности. Публичность проверяем в БД: индекс может отстать на минуту.
        $visibleCategories = array_flip((new CategoryTree)->visibleIds());

        return InstrumentModel::search($query)
            ->take(self::LIMIT * self::OVERFETCH)
            ->get()
            ->filter(fn (InstrumentModel $model): bool => $model->status === InstrumentModelStatus::Active
                && isset($visibleCategories[$model->category_id]))
            ->take(self::LIMIT)
            ->values();
    }
}
