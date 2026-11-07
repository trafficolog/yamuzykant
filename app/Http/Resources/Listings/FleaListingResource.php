<?php

declare(strict_types=1);

namespace App\Http\Resources\Listings;

use App\Support\PostedAgo;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * Карточка выдачи Барахолки из документа индекса. Белый список полей: серийный номер, почта, user_id,
 * итоговая цена, описание и геоточка наружу не уходят, даже если попали в документ.
 *
 * @property array<string, mixed> $resource
 */
final class FleaListingResource extends JsonResource
{
    /** @param  array<string, mixed>  $hit */
    public function __construct(array $hit, private readonly string $city)
    {
        parent::__construct($hit);
    }

    /**
     * @param  list<array<string, mixed>>  $hits
     * @return list<array<string, mixed>>
     */
    public static function cards(array $hits, string $city, Request $request): array
    {
        return array_map(
            fn (array $hit): array => (new self($hit, $city))->resolve($request),
            $hits,
        );
    }

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $hit = $this->resource;
        $price = $hit['price'] ?? null;
        $condition = $hit['condition'] ?? null;
        $publishedAt = $hit['published_at'] ?? null;

        return [
            'id' => (string) ($hit['id'] ?? ''),
            'title' => (string) ($hit['title'] ?? ''),
            'price' => is_numeric($price) ? (int) $price : null,
            'condition' => is_string($condition) ? $condition : null,
            'city' => $this->city,
            'ship' => (bool) ($hit['ship'] ?? false),
            'negotiable' => (bool) ($hit['negotiable'] ?? false),
            'posted' => is_numeric($publishedAt) ? PostedAgo::format(Carbon::createFromTimestampUTC((int) $publishedAt)) : null,
        ];
    }
}
