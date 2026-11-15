<?php

declare(strict_types=1);

namespace App\Support;

/** Цена в письмах и текстах сервера: «184 500 ₽» с неразрывными пробелами (AGENTS §5). */
final class Rubles
{
    public static function format(int $amount): string
    {
        return number_format($amount, 0, '', "\u{00A0}")."\u{00A0}₽";
    }
}
