<?php

declare(strict_types=1);

namespace App\Support\Flags;

/**
 * Фича-флаги Pennant. Все выключены по умолчанию; включаются записью в таблицу `features`.
 *
 * Список совпадает с карточкой 0.1.6 и SCREENS.md §2; `premoderation` — SPEC §6.1, ARCHITECTURE §7.
 */
enum FeatureFlag: string
{
    case CatalogNew = 'catalog_new';
    case Masters = 'masters';
    case SalePrices = 'sale_prices';
    case Accessories = 'accessories';
    case Companies = 'companies';
    case Wallet = 'wallet';
    case SafeDeal = 'safe_deal';
    case R1Public = 'r1_public';
    case Premoderation = 'premoderation';
}
