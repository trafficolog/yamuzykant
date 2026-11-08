<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Enums\InstrumentModelStatus;
use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\City;
use App\Domain\Catalog\Models\InstrumentModel;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use App\Domain\Search\Jobs\SyncListingToIndex;
use App\Domain\Search\ListingIndex;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Meilisearch\Contracts\TasksQuery;
use RuntimeException;

/**
 * Демо-выдача Барахолки для e2e и локальной разработки (карточка 3.1.2): объявления из прототипа
 * «Десктоп - Каталог» в Москве (27 штук, 8 из них с доставкой) и одно в Казани. Идемпотентен: прежние
 * демо-объявления (продавцы @flea-demo.test) убираются и из индекса. Работает только в local, testing и e2e.
 */
class FleaDemoSeeder extends Seeder
{
    private const DOMAIN = 'flea-demo.test';

    /** Название, цена, состояние, доставка — первые 12 строк прототипа. */
    private const LOTS = [
        ['Fender American Vintage ’57 Stratocaster 2009', 184_500, 'excellent', false],
        ['Gibson Les Paul Studio 2014, Wine Red', 149_000, 'very-good', true],
        ['Ibanez RG550 Genesis, Road Flare Red', 96_000, 'excellent', false],
        ['Fender Japan Telecaster TL52, 1990', 72_000, 'very-good', true],
        ['Gibson SG Standard 2015, Heritage Cherry', 118_000, 'good', true],
        ['Squier Classic Vibe ’50s Stratocaster', 38_000, 'excellent', true],
        ['Epiphone Casino 2012, Natural', 52_000, 'good', true],
        ['PRS SE Custom 24, 2019', 58_000, 'mint', false],
        ['Jackson Soloist SL2 2018', 89_000, 'excellent', true],
        ['Ibanez RG370 1996', 34_000, 'fair', false],
        ['Gretsch G5420T Electromatic, Orange', 89_000, 'excellent', true],
        ['ESP LTD EC-1000 2016, Vintage Black', 74_000, 'very-good', true],
    ];

    private const FILLER_CONDITIONS = ['excellent', 'very-good', 'good', 'mint', 'fair'];

    public function run(): void
    {
        if (! app()->environment(['local', 'testing', 'e2e'])) {
            throw new RuntimeException('FleaDemoSeeder работает только в local, testing и e2e.');
        }

        // Индекс обновляется сразу, а не очередью: после сидера выдача готова.
        config(['queue.default' => 'sync']);

        if (! Category::query()->where('slug', 'elektrogitary')->exists()) {
            $this->call(CatalogSeeder::class);
        }

        $this->clean();
        ListingIndex::default()->prepare();

        $category = Category::query()->where('slug', 'elektrogitary')->firstOrFail();
        $model = InstrumentModel::query()->firstOrCreate(
            ['brand' => 'Fender', 'name' => 'American Vintage ’57 Stratocaster'],
            ['category_id' => $category->id, 'status' => InstrumentModelStatus::Active],
        );
        $moscow = City::query()->where('slug', 'moscow')->firstOrFail();
        $kazan = City::query()->where('slug', 'kazan')->firstOrFail();

        $lots = self::LOTS;
        for ($i = 1; $i <= 15; $i++) {
            $lots[] = [sprintf('Гитара демо %02d', $i), 10_000 + $i * 1_000, self::FILLER_CONDITIONS[$i % 5], false];
        }

        // Разные секунды публикации: порядок «сначала свежие» определён, и выдача с главной не зависит от гонки (3.1.4).
        $start = now()->subMinutes(10);
        foreach ($lots as $index => [$title, $price, $condition, $ship]) {
            Carbon::setTestNow($start->copy()->addSeconds($index));
            $this->publish($category, $model, $moscow, $title, $price, $condition, $ship, $index);
        }
        Carbon::setTestNow($start->copy()->addSeconds(count($lots)));
        $this->publish($category, $model, $kazan, 'Gibson Les Paul Казань', 120_000, 'good', true, 99);
        Carbon::setTestNow();

        $this->waitForIndex();
    }

    private function publish(Category $category, InstrumentModel $model, City $city, string $title, int $price, string $condition, bool $ship, int $index): void
    {
        $user = User::factory()->create(['email' => sprintf('seller-%d@%s', $index, self::DOMAIN)]);

        $listing = new Listing;
        $listing->forceFill(['user_id' => $user->id]);
        $listing->fill([
            'category_id' => $category->id,
            'model_id' => $model->id,
            'title' => $title,
            'year' => 2015,
            'serial_enc' => 'DEMO'.$index,
            'condition' => $condition,
            'description' => 'Демо-объявление для проверки выдачи.',
            'price' => $price,
            'negotiable' => $index % 2 === 0,
            'meet' => true,
            'ship' => $ship,
            'city_id' => $city->id,
        ]);
        $listing->save();

        app(ListingStateMachine::class)->publish($listing);
    }

    private function clean(): void
    {
        $users = User::query()->where('email', 'like', '%@'.self::DOMAIN)->pluck('id');
        $ids = Listing::query()->whereIn('user_id', $users)->pluck('id');

        Listing::query()->whereIn('id', $ids)->delete();
        foreach ($ids as $id) {
            (new SyncListingToIndex((string) $id))->handle();
        }
        User::query()->whereIn('id', $users)->delete();
    }

    private function waitForIndex(): void
    {
        $client = ListingIndex::default()->client();
        $deadline = microtime(true) + 30;

        do {
            $pending = $client->getTasks((new TasksQuery)->setStatuses(['enqueued', 'processing']))->getResults();
            if ($pending === []) {
                return;
            }
            usleep(100_000);
        } while (microtime(true) < $deadline);

        throw new RuntimeException('Meilisearch не доработал задачи за 30 с.');
    }
}
