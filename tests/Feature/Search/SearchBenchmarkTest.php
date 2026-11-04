<?php

declare(strict_types=1);

use App\Domain\Search\ListingIndex;
use Illuminate\Support\Facades\Artisan;
use Meilisearch\Contracts\DocumentsQuery;
use Tests\Support\MeilisearchIndex;

// Критерий 3.1.1: «p95 поиска ≤ 300 мс на 100 тыс.» — команды сида и замера. Здесь проверяются на малом объёме
// и отдельном индексе; полный прогон на 100 тыс. — вручную, отчёт в PR.

const BENCH_INDEX = 'listings_bench_test';

afterEach(function () {
    ListingIndex::named(BENCH_INDEX)->delete();
    MeilisearchIndex::waitForTasks();
});

it('сид нагрузочных данных кладёт заданное число документов в отдельный индекс', function () {
    $exit = Artisan::call('listings:seed-load', ['count' => 250, '--index' => BENCH_INDEX]);
    MeilisearchIndex::waitForTasks();

    $index = ListingIndex::named(BENCH_INDEX);
    $total = $index->client()->index($index->name)->getDocuments((new DocumentsQuery)->setLimit(1))->getTotal();

    expect($exit)->toBe(0)
        ->and($total)->toBe(250);
});

it('документы нагрузочного сида — той же схемы, что и боевой индекс, без персональных данных', function () {
    Artisan::call('listings:seed-load', ['count' => 20, '--index' => BENCH_INDEX]);
    MeilisearchIndex::waitForTasks();

    $index = ListingIndex::named(BENCH_INDEX);
    $document = $index->client()->index($index->name)->getDocuments()->getResults()[0];
    $keys = array_keys($document);
    sort($keys);

    expect($keys)->toBe([
        '_geo', 'aliases', 'brand', 'category_path', 'city_id', 'condition', 'description', 'id',
        'model', 'negotiable', 'price', 'published_at', 'ship', 'title',
    ]);
});

it('сид не трогает боевой индекс listings', function () {
    MeilisearchIndex::resetListings();

    Artisan::call('listings:seed-load', ['count' => 30, '--index' => BENCH_INDEX]);
    MeilisearchIndex::waitForTasks();

    $main = ListingIndex::default();
    expect($main->client()->index($main->name)->getDocuments((new DocumentsQuery)->setLimit(1))->getTotal())->toBe(0);
});

it('замер печатает p50, p95, p99 и укладывается в порог', function () {
    Artisan::call('listings:seed-load', ['count' => 500, '--index' => BENCH_INDEX]);
    MeilisearchIndex::waitForTasks();

    $exit = Artisan::call('listings:benchmark-search', ['--index' => BENCH_INDEX, '--runs' => 40, '--threshold' => 300]);

    expect($exit)->toBe(0)
        ->and(Artisan::output())->toContain('p50')->toContain('p95')->toContain('p99');
});

it('замер завершается с ошибкой, если p95 выше порога', function () {
    Artisan::call('listings:seed-load', ['count' => 100, '--index' => BENCH_INDEX]);
    MeilisearchIndex::waitForTasks();

    $exit = Artisan::call('listings:benchmark-search', ['--index' => BENCH_INDEX, '--runs' => 20, '--threshold' => 0]);

    expect($exit)->toBe(1);
});
