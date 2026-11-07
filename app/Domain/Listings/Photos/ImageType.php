<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

use finfo;

/**
 * Тип загруженного файла по содержимому (ARCHITECTURE §7), а не по расширению или заголовку браузера.
 */
enum ImageType: string
{
    case Jpeg = 'image/jpeg';
    case Png = 'image/png';
    case Heic = 'image/heic';

    /** Сколько байт начала файла читать для определения типа. */
    public const SNIFF_BYTES = 4096;

    /** Тип по первым байтам файла; null — не JPEG, PNG или HEIC (например, PDF с расширением .jpg). */
    public static function sniff(string $head): ?self
    {
        $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($head);

        return match ($mime) {
            'image/jpeg' => self::Jpeg,
            'image/png' => self::Png,
            'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence' => self::Heic,
            default => null,
        };
    }
}
