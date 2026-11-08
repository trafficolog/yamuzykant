<?php

declare(strict_types=1);

namespace App\Domain\Search\Console;

use App\Domain\Catalog\Models\City;
use App\Domain\Listings\Enums\Condition;
use App\Domain\Search\ListingIndex;
use App\Domain\Search\ListingSearch;
use App\Domain\Search\ListingSearchResult;
use App\Domain\Search\ListingSort;
use App\Domain\Search\LoadData;
use Illuminate\Console\Command;

/**
 * Замер скорости поиска (SPEC §8: ≤ 300 мс p95 на 100 тыс. объявлений). Гоняет смесь типичных запросов Барахолки
 * через ListingSearch — с городом, фасетами и сортировками — и считает перцентили полного времени запроса
 * (с обращением к Meilisearch по HTTP). Код возврата 1, если p95 выше порога.
 */
final class BenchmarkSearchCommand extends Command
{
    protected $signature = 'listings:benchmark-search
        {--index=listings_bench : Имя индекса без префикса окружения (заполняется listings:seed-load)}
        {--runs=500 : Сколько запросов замерить}
        {--threshold=300 : Порог p95, мс}';

    protected $description = 'Замерить p50/p95/p99 поиска по нагрузочному индексу';

    public function handle(): int
    {
        $index = ListingIndex::named((string) $this->option('index'));
        $runs = max(1, (int) $this->option('runs'));
        $threshold = (float) $this->option('threshold');

        $total = $index->index()->stats()['numberOfDocuments'] ?? 0;
        $this->line("Индекс {$index->name}: {$total} документов, запросов: {$runs}.");

        $scenarios = $this->scenarios($index);

        // Прогрев: первые запросы холодные.
        for ($i = 0; $i < 20; $i++) {
            $scenarios[$i % count($scenarios)]($i);
        }

        $wall = [];
        $server = [];
        for ($i = 0; $i < $runs; $i++) {
            $start = hrtime(true);
            $result = $scenarios[$i % count($scenarios)]($i);
            $wall[] = (hrtime(true) - $start) / 1e6;
            $server[] = (float) $result->processingTimeMs;
        }

        $p95 = $this->percentile($wall, 95);
        $this->line(sprintf(
            'Полное время запроса, мс: p50 %.1f · p95 %.1f · p99 %.1f · max %.1f',
            $this->percentile($wall, 50),
            $p95,
            $this->percentile($wall, 99),
            max($wall),
        ));
        $this->line(sprintf(
            'Время в Meilisearch, мс:  p50 %.1f · p95 %.1f · p99 %.1f',
            $this->percentile($server, 50),
            $this->percentile($server, 95),
            $this->percentile($server, 99),
        ));

        if ($p95 > $threshold) {
            $this->error(sprintf('p95 %.1f мс выше порога %.0f мс.', $p95, $threshold));

            return self::FAILURE;
        }
        $this->info(sprintf('p95 %.1f мс в пределах порога %.0f мс.', $p95, $threshold));

        return self::SUCCESS;
    }

    /**
     * @return list<callable(int): ListingSearchResult>
     */
    private function scenarios(ListingIndex $index): array
    {
        $city = static function (int $i): City {
            $number = $i % count(LoadData::CITIES);
            [$lat, $lng] = LoadData::CITIES[$number];

            return (new City)->forceFill(['id' => $number + 1, 'lat' => $lat, 'lng' => $lng]);
        };
        $search = static fn (int $i): ListingSearch => ListingSearch::inCity($city($i), $index);

        return [
            // Главная выдача города без запроса.
            fn (int $i) => $search($i)->get(),
            fn (int $i) => $search($i)->get(page: 3),
            // Текстовые запросы, русские и латинские, с опечаткой.
            fn (int $i) => $search($i)->matching('stratocaster')->get(),
            fn (int $i) => $search($i)->matching('стратокастер')->get(),
            fn (int $i) => $search($i)->matching('гитара fender')->get(),
            fn (int $i) => $search($i)->matching('stratocastr')->priceBetween(20_000, 200_000)->get(),
            fn (int $i) => $search($i)->matching('педаль для гитары')->withShipping()->get(),
            // Категория, состояние, сортировки.
            fn (int $i) => $search($i)->inCategory('gitary')->conditions([Condition::Mint, Condition::Excellent])->sortBy(ListingSort::PriceAsc)->get(),
            fn (int $i) => $search($i)->inCategory('pedali-i-usiliteli/pedali')->sortBy(ListingSort::PriceDesc)->get(),
            fn (int $i) => $search($i)->matching('yamaha')->negotiable()->sortBy(ListingSort::Newest)->get(),
            fn (int $i) => $search($i)->matching('fender')->sortBy(ListingSort::PriceAsc)->get(),
        ];
    }

    /** @param  list<float>  $values */
    private function percentile(array $values, int $percent): float
    {
        sort($values);
        $rank = (int) ceil($percent / 100 * count($values));

        return $values[max(0, $rank - 1)];
    }
}
