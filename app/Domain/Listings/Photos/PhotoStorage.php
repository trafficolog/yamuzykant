<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;

/**
 * Диск фото (config photos.disk): исходники в uploads/{listing}/{uuid}, версии в photos/{listing}/{uuid}/.
 * Бакет закрыт: наружу файлы отдаёт только PhotoMediaController, исходники — никогда.
 */
final class PhotoStorage
{
    public static function disk(): Filesystem
    {
        return Storage::disk(Config::string('photos.disk'));
    }

    public static function uploadKey(string $listingId, string $uploadId): string
    {
        return "uploads/{$listingId}/{$uploadId}";
    }

    public static function photoDirectory(string $listingId, string $photoId): string
    {
        return "photos/{$listingId}/{$photoId}";
    }

    /**
     * Первые байты файла — для определения типа по содержимому.
     *
     * @param  int<1, max>  $bytes
     */
    public static function head(string $key, int $bytes): string
    {
        $stream = self::disk()->readStream($key);
        if (! is_resource($stream)) {
            return '';
        }

        try {
            return (string) fread($stream, $bytes);
        } finally {
            fclose($stream);
        }
    }
}
