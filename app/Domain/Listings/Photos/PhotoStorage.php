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
     * Каталог версий фото строго в формате photoDirectory(): `photos/{listingId}/{photoId}`, оба id — UUID,
     * то есть только латиница, цифры и дефис. Белый список, а не поиск опасного: Flysystem заменяет `\` на `/`
     * и выбрасывает сегменты `.` и `..`, так что `photos/.` или `photos/x\..\..` превратились бы в `photos`
     * или корень, и deleteDirectory снёс бы все фото или весь бакет. `\z`, а не `$`: `$` пропускает `\n` в конце.
     */
    public static function isPhotoDirectory(string $path): bool
    {
        return preg_match('#\Aphotos/[A-Za-z0-9-]+/[A-Za-z0-9-]+\z#', $path) === 1;
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
