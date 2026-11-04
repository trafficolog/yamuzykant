<?php

declare(strict_types=1);

namespace App\Domain\Search\Console;

use App\Domain\Search\ListingIndex;
use App\Domain\Search\LoadData;
use Illuminate\Console\Command;
use Meilisearch\Contracts\TasksQuery;

/**
 * Нагрузочные данные: документы той же схемы, что и боевой индекс, пишутся прямо в отдельный индекс
 * (по умолчанию `listings_bench`). База данных и боевой индекс `listings` не затрагиваются.
 */
final class SeedLoadListingsCommand extends Command
{
    protected $signature = 'listings:seed-load
        {count=100000 : Сколько объявлений создать}
        {--index=listings_bench : Имя индекса без префикса окружения}
        {--batch=5000 : Размер порции записи}';

    protected $description = 'Заполнить отдельный индекс синтетическими объявлениями для замера скорости поиска';

    public function handle(): int
    {
        $count = max(1, (int) $this->argument('count'));
        $batch = max(1, (int) $this->option('batch'));
        $index = ListingIndex::named((string) $this->option('index'));

        if ($index->name === ListingIndex::default()->name) {
            $this->error('Нагрузочный индекс не может совпадать с боевым.');

            return self::FAILURE;
        }

        $index->delete();
        $client = $index->client();
        // Удаление асинхронно: ждём все задачи, прежде чем создавать индекс заново.
        $this->waitIdle($index);
        $index->prepare();

        $tasks = [];
        for ($from = 1; $from <= $count; $from += $batch) {
            $documents = [];
            for ($number = $from; $number < $from + $batch && $number <= $count; $number++) {
                $documents[] = LoadData::document($number);
            }
            $tasks[] = $index->index()->addDocuments($documents, 'id')['taskUid'];
            $this->output->write('.');
        }
        $this->newLine();

        $client->waitForTasks($tasks, 1_800_000, 500);
        $this->info("Создано объявлений: {$count}, индекс {$index->name}.");

        return self::SUCCESS;
    }

    private function waitIdle(ListingIndex $index): void
    {
        $deadline = microtime(true) + 60;
        do {
            $pending = $index->client()->getTasks(
                (new TasksQuery)->setStatuses(['enqueued', 'processing']),
            )->getResults();
            if ($pending === []) {
                return;
            }
            usleep(100_000);
        } while (microtime(true) < $deadline);
    }
}
