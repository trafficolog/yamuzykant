<?php

declare(strict_types=1);

namespace App\Domain\Moderation\AutoChecks;

/**
 * Расстояние Хэмминга между pHash фото (ListingPhoto::$phash — 16 hex-символов, 64 бита).
 */
final class PerceptualHash
{
    public const BITS = 64;

    /** Для хэша неверного вида: заведомо «не дубль». */
    public const MAX_DISTANCE = self::BITS;

    public static function distance(string $a, string $b): int
    {
        if (! self::valid($a) || ! self::valid($b)) {
            return self::MAX_DISTANCE;
        }

        $distance = 0;
        // По 8 hex-символов (32 бита): hexdec 16 символов вышел бы за int.
        foreach ([0, 8] as $offset) {
            $xor = hexdec(substr($a, $offset, 8)) ^ hexdec(substr($b, $offset, 8));
            while ($xor !== 0) {
                $xor &= $xor - 1;
                $distance++;
            }
        }

        return $distance;
    }

    private static function valid(string $hash): bool
    {
        return preg_match('/^[0-9a-f]{16}$/i', $hash) === 1;
    }
}
