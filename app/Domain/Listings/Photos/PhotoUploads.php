<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

use Carbon\CarbonInterface;

/**
 * Граница с хранилищем для загрузки из браузера (SDD-TDD §3: внешние сервисы — через интерфейсы).
 * Размер и тип входят в подпись: файл другого размера или типа хранилище не примет.
 */
interface PhotoUploads
{
    public function ticket(string $key, string $contentType, int $size, CarbonInterface $expiresAt): UploadTicket;
}
