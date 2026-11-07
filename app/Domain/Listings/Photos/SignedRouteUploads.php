<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

use Carbon\CarbonInterface;
use Illuminate\Support\Facades\URL;

/**
 * Загрузка через приложение по подписанному URL — когда хранилище не S3 (тесты, e2e без MinIO).
 * Ключ, размер и тип входят в подпись маршрута; приёмник сверяет их с запросом.
 */
final class SignedRouteUploads implements PhotoUploads
{
    public const ROUTE = 'photos.upload.local';

    public function ticket(string $key, string $contentType, int $size, CarbonInterface $expiresAt): UploadTicket
    {
        return new UploadTicket(
            url: URL::temporarySignedRoute(self::ROUTE, $expiresAt, [
                'key' => $key,
                'type' => $contentType,
                'size' => $size,
            ]),
            method: 'PUT',
            headers: ['Content-Type' => $contentType],
            expiresAt: $expiresAt,
        );
    }
}
