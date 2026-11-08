<?php

declare(strict_types=1);

namespace App\Domain\Moderation\AutoChecks;

use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\SaleRecord;

/**
 * Цена ниже рынка: строго меньше `moderation.price_median_percent` % (по SPEC — 60) медианы итоговых цен
 * продаж той же модели, при не менее `moderation.price_median_min_sales` (5) продаж с известной ценой.
 * «Договорная» (null) и «Бесплатно» (0) пропускаются (BR-11); без модели проверять не с чем.
 * Только сигнал риска.
 */
final class LowPriceCheck implements AutoCheck
{
    public function code(): string
    {
        return 'low_price';
    }

    public function blocking(): bool
    {
        return false;
    }

    public function inspect(Listing $listing): array
    {
        if ($listing->price === null || $listing->price <= 0 || $listing->model_id === null) {
            return [];
        }

        /** @var list<int> $prices */
        $prices = SaleRecord::query()
            ->join('listings', 'listings.id', '=', 'sale_records.listing_id')
            ->where('listings.model_id', $listing->model_id)
            ->whereNotNull('sale_records.final_price')
            ->orderBy('sale_records.final_price')
            ->pluck('sale_records.final_price')
            ->map(fn (mixed $price): int => (int) $price)
            ->all();

        $sales = count($prices);
        if ($sales === 0 || $sales < (int) config('moderation.price_median_min_sales')) {
            return [];
        }

        $middle = intdiv($sales, 2);
        $median = $sales % 2 === 1 ? $prices[$middle] : ($prices[$middle - 1] + $prices[$middle]) / 2;
        $percent = (int) config('moderation.price_median_percent');

        // Целые проценты без деления: цена < медиана × процент / 100.
        if ($listing->price * 100 >= $median * $percent) {
            return [];
        }

        $median = (int) round($median);

        return [new Finding(
            code: $this->code(),
            field: 'price',
            message: (string) __('moderation.signals.low_price', [
                'price' => self::money($listing->price),
                'percent' => $percent,
                'median' => self::money($median),
                'sales' => $sales,
            ]),
            details: ['price' => $listing->price, 'median' => $median, 'sales' => $sales, 'percent' => $percent],
        )];
    }

    /** `184 500` с неразрывным пробелом (AGENTS.md §5). */
    private static function money(int $amount): string
    {
        return number_format($amount, 0, '', "\u{00A0}");
    }
}
