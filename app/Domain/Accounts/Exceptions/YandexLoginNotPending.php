<?php

declare(strict_types=1);

namespace App\Domain\Accounts\Exceptions;

use RuntimeException;

/**
 * Шаг «Введите почту» без входа через Яндекс ID (нет ожидающего Яндекс ID или он истёк).
 */
final class YandexLoginNotPending extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('No pending Yandex ID login in session.');
    }
}
