<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
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

    /**
     * Каталог версий фото: `photos/{...}` с непустым хвостом, без пустых сегментов и `..`.
     * Иначе deleteDirectory('') на диске с корневым префиксом пошёл бы по всему бакету.
     */
    public static function isPhotoDirectory(string $path): bool
    {
        return preg_match('#^photos/[^/]+(/[^/]+)*$#', $path) === 1 && ! in_array('..', explode('/', $path), true);
    }

    /** Удалить каталог версий; небезопасный path пропускается с warning. Возвращает, удалён ли каталог. */
    public static function deleteVersions(string $path): bool
    {
        if (! self::isPhotoDirectory($path)) {
            Log::warning('Каталог версий фото не удалён: path вне photos/', ['path' => $path]);

            return false;
        }

        return self::disk()->deleteDirectory($path);
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
