<?php

declare(strict_types=1);

namespace App\Domain\Search;

use App\Domain\Listings\Models\Listing;
use Generator;
use Meilisearch\Client;
use Meilisearch\Contracts\DocumentsQuery;
use Meilisearch\Endpoints\Indexes;
use Meilisearch\Exceptions\ApiException;

/**
 * Индекс объявлений в Meilisearch: имя с префиксом окружения, настройки из config/scout.php.
 * Основной индекс — `listings`; именованные (нагрузочные) — рядом, с теми же настройками.
 */
final class ListingIndex
{
    private function __construct(public readonly string $name) {}

    public static function default(): self
    {
        return new self((new Listing)->searchableAs());
    }

    /** Отдельный индекс того же окружения, например нагрузочный `listings_bench`. */
    public static function named(string $name): self
    {
        return new self((string) config('scout.prefix').$name);
    }

    public function client(): Client
    {
        return new Client((string) config('scout.meilisearch.host'), config('scout.meilisearch.key'));
    }

    public function index(): Indexes
    {
        return $this->client()->index($this->name);
    }

    /** @return array<string, mixed> */
    public static function settings(): array
    {
        /** @var array<string, mixed> $settings */
        $settings = config('scout.meilisearch.index-settings.listings', []);

        return $settings;
    }

    /** Создаёт индекс (если нет) и применяет настройки; ждёт завершения. */
    public function prepare(): void
    {
        $client = $this->client();
        $client->waitForTask($client->createIndex($this->name, ['primaryKey' => 'id'])['taskUid'], 30_000);
        $client->waitForTask($this->index()->updateSettings(self::settings())['taskUid'], 30_000);
    }

    /** Удаляет индекс; отсутствие индекса не ошибка. */
    public function delete(): void
    {
        try {
            $this->client()->deleteIndex($this->name);
        } catch (ApiException) {
            // Индекса нет — удалять нечего.
        }
    }

    /**
     * Все id документов индекса, порциями. Нет индекса — пусто.
     *
     * @param  int<1, max>  $chunk
     * @return Generator<int, string>
     */
    public function ids(int $chunk = 1000): Generator
    {
        $page = 0;
        do {
            try {
                $results = $this->index()->getDocuments(
                    (new DocumentsQuery)->setFields(['id'])->setLimit($chunk)->setOffset($page * $chunk),
                );
            } catch (ApiException $exception) {
                if ($exception->httpStatus === 404) {
                    return;
                }

                throw $exception;
            }

            foreach ($results->getResults() as $document) {
                yield (string) $document['id'];
            }
            $page++;
        } while ($page * $chunk < $results->getTotal());
    }
}
