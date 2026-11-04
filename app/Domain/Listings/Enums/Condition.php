<?php

declare(strict_types=1);

namespace App\Domain\Listings\Enums;

/**
 * Состояние инструмента — 8 ступеней BR-02, от лучшего к худшему.
 * Значения совпадают с ключами ConditionBadge дизайн-системы.
 */
enum Condition: string
{
    case New = 'new';
    case Mint = 'mint';
    case Excellent = 'excellent';
    case VeryGood = 'very-good';
    case Good = 'good';
    case Fair = 'fair';
    case Poor = 'poor';
    case Parts = 'parts';

    public function label(): string
    {
        return (string) __('listings.condition.'.$this->value);
    }
}
