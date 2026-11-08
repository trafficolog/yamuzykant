<?php

declare(strict_types=1);

namespace App\Domain\Listings\Exceptions;

use RuntimeException;

/**
 * У продавца уже максимум активных объявлений (BR-06, config listings.active_limit). Публикация отклоняется,
 * черновик остаётся. Текст для продавца — lang/ru/listings.php, limit.reached.
 */
final class ListingLimitReached extends RuntimeException
{
    public function __construct(public readonly int $used, public readonly int $limit)
    {
        parent::__construct(trans_choice('listings.limit.reached', $limit, ['count' => $limit]));
    }
}
