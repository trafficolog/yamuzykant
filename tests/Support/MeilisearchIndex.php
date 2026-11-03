<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Domain\Catalog\Models\InstrumentModel;
use Illuminate\Support\Facades\Artisan;
use Meilisearch\Client;
use Meilisearch\Contracts\TasksQuery;
use RuntimeException;

/**
 * Настоящий Meilisearch из compose (или сервис job php в CI). Индексация асинхронна,
 * поэтому после записи тесты ждут, пока Meilisearch доработает очередь задач.
 */
final class MeilisearchIndex
{
    /** Пустой индекс моделей с применёнными настройками и синонимами. */
    public static function reset(): void
    {
        Artisan::call('scout:sync-index-settings');
        Artisan::call('scout:flush', ['model' => InstrumentModel::class]);
        self::waitForTasks();
    }

    /** Ждёт, пока в Meilisearch не останется задач в статусах enqueued и processing. */
    public static function waitForTasks(int $timeoutSeconds = 10): void
    {
        $client = new Client(config('scout.meilisearch.host'), config('scout.meilisearch.key'));
        $deadline = microtime(true) + $timeoutSeconds;

        do {
            $pending = $client->getTasks((new TasksQuery)->setStatuses(['enqueued', 'processing']))->getResults();
            if ($pending === []) {
                return;
            }
            usleep(50_000);
        } while (microtime(true) < $deadline);

        throw new RuntimeException('Meilisearch не доработал задачи за '.$timeoutSeconds.' с.');
    }
}
