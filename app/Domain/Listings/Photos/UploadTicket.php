<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

use Carbon\CarbonInterface;

/**
 * Куда и как браузер загружает файл: метод, URL с подписью и заголовки, которые нужно отправить.
 */
final readonly class UploadTicket
{
    /**
     * @param  array<string, string>  $headers
     */
    public function __construct(
        public string $url,
        public string $method,
        public array $headers,
        public CarbonInterface $expiresAt,
    ) {}
}
