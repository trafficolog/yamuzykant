<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Models\Category;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;

/** Данные тестов «Мои объявления» (2.1.5): объявление продавца с тремя готовыми фото, первое — серийный номер. */
final class MyListingFixtures
{
    public static function listing(User $owner, ListingStatus $status = ListingStatus::Published, int $photos = 3): Listing
    {
        $listing = Listing::factory()->for($owner)->inStatus($status)->create([
            'title' => 'Fender American Vintage ’57 Stratocaster',
            'price' => 184_500,
            'category_id' => Category::factory()->create(['parent_id' => null, 'is_visible' => true])->id,
        ]);
        for ($i = 0; $i < $photos; $i++) {
            $photo = ListingPhoto::query()->create([
                'listing_id' => $listing->id,
                'path' => "photos/{$listing->id}/{$i}",
                'position' => $i,
                'is_serial' => $i === 0,
            ]);
            $photo->forceFill(['processed_at' => now()])->save();
        }

        return $listing;
    }

    /**
     * Содержимое формы изменения: то, что уже в объявлении, с поверх-значениями.
     *
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    public static function form(Listing $listing, array $overrides = []): array
    {
        return array_merge([
            'category_id' => $listing->category_id,
            'title' => $listing->title,
            'model_id' => null,
            'year' => $listing->year,
            'condition' => $listing->condition?->value,
            'description' => $listing->description,
            'price_mode' => 'amount',
            'price' => $listing->price,
            'negotiable' => $listing->negotiable,
            'meet' => true,
            'ship' => false,
        ], $overrides);
    }
}
