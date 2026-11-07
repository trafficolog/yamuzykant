<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

use Illuminate\Support\Facades\Config;

/**
 * Размер изображения в пикселях по заголовку — без декодирования (защита от «бомбы распаковки»).
 */
final class ImageDimensions
{
    /** Сколько байт начала файла читать в confirm: у JPEG маркер SOF стоит после EXIF (до 64 КБ). */
    public const HEAD_BYTES = 262_144;

    /**
     * Ширина и высота JPEG или PNG; null — заголовок не найден (не картинка или обрезан).
     *
     * @return array{int, int}|null
     */
    public static function of(string $bytes): ?array
    {
        $size = @getimagesizefromstring($bytes);
        if ($size === false || $size[0] < 1 || $size[1] < 1) {
            return null;
        }

        return [$size[0], $size[1]];
    }

    public static function tooLarge(int $width, int $height): bool
    {
        return $width * $height > Config::integer('photos.max_pixels');
    }
}
