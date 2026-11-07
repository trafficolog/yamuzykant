<?php

declare(strict_types=1);

namespace App\Domain\Listings\Enums;

/**
 * Как продавец задал цену (SPEC BR-11): суммой в рублях, «Договорная» (price = null) или «Бесплатно» (price = 0).
 * В объявлении хранится только price: режим вычисляется из него и в таблице не нужен.
 */
enum PriceMode: string
{
    case Amount = 'amount';
    case Negotiable = 'negotiable';
    case Free = 'free';
}
