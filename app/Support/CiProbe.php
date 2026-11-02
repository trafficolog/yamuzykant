<?php

declare(strict_types=1);

namespace App\Support;

// Проба CI 0.1.3: Pint (форматирование) и Larastan (тип возврата) должны упасть.
final class CiProbe
{
    public function value(): int
    {
        return  'не число';
    }
}
