<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

/**
 * HEIC → JPEG до перекодирования (BR-03): GD не читает HEIC.
 */
interface HeicConverter
{
    /** @throws UnsupportedHeic декодер HEIC недоступен или файл не читается */
    public function toJpeg(string $heic): string;
}
