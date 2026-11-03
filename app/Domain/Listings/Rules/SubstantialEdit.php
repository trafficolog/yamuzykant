<?php

declare(strict_types=1);

namespace App\Domain\Listings\Rules;

use App\Domain\Listings\Enums\ListingEvent;

/**
 * Правило «существенная правка» (SPEC §6.1) — единственное место, где оно задано.
 *
 * Существенная: фото, модель, описание, состояние. Снижение цены и способы передачи — без повторной
 * модерации; прочие поля (торг, цена вверх, год, город…) по SPEC в список не входят — тоже несущественные.
 */
final class SubstantialEdit
{
    /** Псевдополе изменения фото: фото хранятся в listing_photos, а не в колонке объявления. */
    public const PHOTOS = 'photos';

    /** @var list<string> */
    public const FIELDS = [self::PHOTOS, 'model_id', 'description', 'condition'];

    /**
     * Событие правки опубликованного объявления.
     *
     * @param  list<string>  $changed  изменённые поля (включая PHOTOS)
     */
    public static function eventFor(array $changed, ?int $oldPrice, ?int $newPrice): ListingEvent
    {
        if (array_intersect($changed, self::FIELDS) !== []) {
            return ListingEvent::SubstantialEdit;
        }

        if ($changed === ['price'] && $oldPrice !== null && $newPrice !== null && $newPrice < $oldPrice) {
            return ListingEvent::PriceDrop;
        }

        return ListingEvent::MinorEdit;
    }
}
