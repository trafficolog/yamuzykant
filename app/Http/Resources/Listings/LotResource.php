<?php

declare(strict_types=1);

namespace App\Http\Resources\Listings;

use App\Domain\Catalog\Models\Category;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Support\PostedAgo;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

/**
 * Страница объявления (UC-V1): явный список полей. Почта и yandex_id продавца, полный серийный номер, user_id
 * объявления, итоговая цена и пути хранилища наружу не уходят (BR-04, AGENTS §4); id продавца — только для адреса
 * его страницы (3.1.6). Цена — как в БД: `null` — «Договорная»,
 * `0` — «Бесплатно» (BR-11), подпись выбирает фронт; «Готов к торгу» — только при сумме.
 *
 * @mixin Listing
 */
final class LotResource extends JsonResource
{
    /**
     * @param  Collection<int, Listing>  $similar
     */
    public function __construct(Listing $listing, private readonly Collection $similar)
    {
        parent::__construct($listing);
    }

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        /** @var Listing $listing */
        $listing = $this->resource;
        $viewer = $request->user();
        $price = $listing->price;
        $seller = $listing->user;

        return [
            'listing' => [
                'id' => $listing->id,
                'title' => (string) $listing->title,
                'price' => $price,
                'negotiable' => $price !== null && $price > 0 && $listing->negotiable,
                'condition' => $listing->condition === null ? null : [
                    'value' => $listing->condition->value,
                    'label' => $listing->condition->label(),
                ],
                'year' => $listing->year,
                'brand' => $listing->model?->brand,
                'model' => $listing->model?->name,
                'serial' => $listing->serialMasked(),
                'description' => $listing->description,
                'city' => $listing->city === null ? null : ['type' => $listing->city->settlement_type, 'name' => $listing->city->name],
                'meet' => $listing->meet,
                'ship' => $listing->ship,
                'posted' => $listing->published_at === null ? null : PostedAgo::format($listing->published_at),
                'status' => $listing->status->value,
                'sold' => $listing->status === ListingStatus::Withdrawn && $listing->saleRecord?->reason->isSale() === true,
            ],
            'crumbs' => $this->crumbs($listing->category),
            'photos' => $this->photos($listing, $request),
            'seller' => [
                'id' => $seller->id,
                'name' => $seller->name,
                'city' => $seller->city?->name,
                'since' => $seller->created_at?->year,
            ],
            'viewer' => [
                'authenticated' => $viewer !== null,
                'is_owner' => $viewer !== null && $viewer->id === $listing->user_id,
            ],
            'similar' => $this->similar->map(fn (Listing $similar): array => (new ListingCardResource($similar))->resolve($request))->all(),
        ];
    }

    /**
     * От корня дерева к категории объявления; путь — слаги нарастающим итогом, как в адресах Барахолки.
     *
     * @return list<array{name: string, path: string}>
     */
    private function crumbs(?Category $category): array
    {
        $chain = [];
        for ($node = $category; $node !== null; $node = $node->parent) {
            array_unshift($chain, $node);
        }

        $crumbs = [];
        $path = '';
        foreach ($chain as $node) {
            $path = $path === '' ? $node->slug : $path.'/'.$node->slug;
            $crumbs[] = ['name' => $node->name, 'path' => $path];
        }

        return $crumbs;
    }

    /**
     * Готовые фото, которые отдаст PhotoMediaController этому зрителю (одно правило — PhotoVisibility);
     * фото серийного номера — последним и только владельцу и сотрудникам.
     *
     * @return list<array{id: int, is_serial: bool, urls: array<string, array<string, string>>}>
     */
    private function photos(Listing $listing, Request $request): array
    {
        $photos = [];
        foreach ($listing->photos->sortBy([['is_serial', 'asc'], ['position', 'asc']]) as $photo) {
            $photo->setRelation('listing', $listing);
            $data = (new ListingPhotoResource($photo))->resolve($request);
            if ($data['urls'] === null) {
                continue;
            }
            $photos[] = ['id' => $photo->id, 'is_serial' => $photo->is_serial, 'urls' => $data['urls']];
        }

        return $photos;
    }
}
