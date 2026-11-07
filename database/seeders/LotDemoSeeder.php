<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Enums\InstrumentModelStatus;
use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\City;
use App\Domain\Catalog\Models\InstrumentModel;
use App\Domain\Listings\Enums\WithdrawReason;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Domain\Listings\Photos\ImageType;
use App\Domain\Listings\Photos\PhotoProcessor;
use App\Domain\Listings\Photos\PhotoStorage;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Данные для e2e и визуальной сверки страницы объявления (3.1.5): лот из прототипа — Fender American Vintage ’57
 * Stratocaster за 184 500 ₽, Москва, три фото (первое — серийный номер), пять похожих и одно снятое.
 * Идемпотентен: адреса фиксированы, повторный запуск ничего не меняет. Только для e2e и локальной разработки.
 */
final class LotDemoSeeder extends Seeder
{
    public const LOT = '3a1f0c00-0000-4000-8000-000000000001';

    public const WITHDRAWN = '3a1f0c00-0000-4000-8000-000000000009';

    public const SELLER_EMAIL = 'lot-demo-seller@example.test';

    /** Похожие: id, название, цена, состояние. */
    private const SIMILAR = [
        ['3a1f0c00-0000-4000-8000-000000000002', 'Fender Player Stratocaster 2019, Polar White', 78_000, 'good'],
        ['3a1f0c00-0000-4000-8000-000000000003', 'Fender American Standard Stratocaster 2012', 132_000, 'very-good'],
        ['3a1f0c00-0000-4000-8000-000000000004', 'Squier Classic Vibe ’50s Stratocaster', 38_000, 'excellent'],
        ['3a1f0c00-0000-4000-8000-000000000005', 'Fender Japan ST62, 1994', null, 'very-good'],
        ['3a1f0c00-0000-4000-8000-000000000006', 'Fender Vintera ’50s Stratocaster', 0, 'excellent'],
    ];

    public function run(ListingStateMachine $machine, PhotoProcessor $processor): void
    {
        $city = City::query()->where('name', 'Москва')->firstOrFail();
        $category = Category::query()->where('slug', 'elektrogitary')->firstOrFail();
        $model = InstrumentModel::query()->firstOrCreate(
            ['brand' => 'Fender', 'name' => 'American Vintage ’57 Stratocaster'],
            ['category_id' => $category->id, 'status' => InstrumentModelStatus::Active],
        );
        $seller = User::query()->firstOrCreate(
            ['email' => self::SELLER_EMAIL],
            ['name' => 'Гитарный угол', 'city_id' => $city->id],
        );

        $lot = $this->listing($machine, self::LOT, $seller, $city, $category, $model, [
            'title' => 'Fender American Vintage ’57 Stratocaster 2009, Sunburst',
            'year' => 2009,
            'serial_enc' => 'V091187',
            'condition' => 'excellent',
            'description' => 'Гриф шлифовали один раз, лады в отличном состоянии. Оригинальные звукосниматели, родной твидовый кейс. Отправлю доставкой в защитной упаковке или встречусь в Москве.',
            'price' => 184_500,
            'negotiable' => true,
            'meet' => true,
            'ship' => true,
        ]);
        $this->photos($lot, $processor);

        foreach (self::SIMILAR as [$id, $title, $price, $condition]) {
            $this->listing($machine, $id, $seller, $city, $category, $model, [
                'title' => $title,
                'price' => $price,
                'condition' => $condition,
                'year' => 2019,
                'serial_enc' => null,
                'description' => 'Похожий лот.',
                'negotiable' => false,
                'meet' => true,
                'ship' => false,
            ]);
        }

        $withdrawn = $this->listing($machine, self::WITHDRAWN, $seller, $city, $category, $model, [
            'title' => 'Fender Stratocaster, снята с продажи',
            'price' => 90_000,
            'condition' => 'good',
            'year' => 2015,
            'serial_enc' => null,
            'description' => 'Снятый лот.',
            'negotiable' => false,
            'meet' => true,
            'ship' => false,
        ], publish: true);
        if ($withdrawn->saleRecord === null && $withdrawn->status->value === 'published') {
            $machine->withdraw($withdrawn, WithdrawReason::SoldElsewhere);
        }
    }

    /** @param  array<string, mixed>  $attributes */
    private function listing(
        ListingStateMachine $machine,
        string $id,
        User $seller,
        City $city,
        Category $category,
        InstrumentModel $model,
        array $attributes,
        bool $publish = true,
    ): Listing {
        $existing = Listing::query()->find($id);
        if ($existing !== null) {
            return $existing;
        }

        $listing = new Listing;
        $listing->id = $id;
        $listing->user_id = $seller->id;
        $listing->fill(array_merge(['category_id' => $category->id, 'model_id' => $model->id, 'city_id' => $city->id], $attributes));
        $listing->save();

        if (! $publish) {
            return $listing;
        }

        $published = $machine->publish($listing);
        // Дата фиксирована: подпись «Выставлен …» не должна менять снимок от запуска к запуску.
        $published->forceFill(['published_at' => '2026-01-10 09:00:00'])->saveQuietly();

        return $published;
    }

    /** Три готовых фото без очереди: плоские цветные кадры 1200×900, первое — серийный номер. */
    private function photos(Listing $listing, PhotoProcessor $processor): void
    {
        if (ListingPhoto::query()->where('listing_id', $listing->id)->exists()) {
            return;
        }

        $colors = [[42, 52, 66], [196, 122, 52], [88, 120, 96]];
        foreach ($colors as $position => [$r, $g, $b]) {
            $photo = new ListingPhoto;
            $photo->listing_id = $listing->id;
            $photo->path = PhotoStorage::photoDirectory($listing->id, "demo{$position}");
            $photo->position = $position;
            $photo->is_serial = $position === 0;
            $photo->save();

            $result = $processor->process($this->jpeg($r, $g, $b), ImageType::Jpeg);
            foreach ($result->files as $name => $bytes) {
                PhotoStorage::disk()->put("{$photo->path}/{$name}", $bytes);
            }
            $photo->forceFill(['phash' => $result->phash, 'processed_at' => now()])->save();
        }
    }

    private function jpeg(int $r, int $g, int $b): string
    {
        $image = imagecreatetruecolor(1200, 900);
        if ($image === false) {
            throw new RuntimeException('GD не создал изображение');
        }
        imagefill($image, 0, 0, (int) imagecolorallocate($image, $r, $g, $b));
        ob_start();
        imagejpeg($image, null, 85);

        return (string) ob_get_clean();
    }
}
