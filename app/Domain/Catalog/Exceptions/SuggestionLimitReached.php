<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Exceptions;

use RuntimeException;

/**
 * Пользователь исчерпал суточный лимит предложений моделей (config catalog.suggestions_per_day).
 * Текст для продавца — lang/ru/catalog.php, suggestions_daily_limit.
 */
final class SuggestionLimitReached extends RuntimeException
{
    public function __construct()
    {
        parent::__construct((string) __('catalog.suggestions_daily_limit'));
    }
}
