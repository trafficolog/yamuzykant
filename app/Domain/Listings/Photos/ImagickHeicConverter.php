<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

use Illuminate\Support\Facades\Config;
use Imagick;
use ImagickException;

/**
 * HEIC → JPEG через Imagick (ImageMagick с libheif). Без расширения или кодека — UnsupportedHeic:
 * фото помечается ошибкой «сохраните как JPEG», а не падает воркер.
 *
 * Защита от «бомбы распаковки»: лимиты ресурсов ImageMagick (память, площадь, ширина, высота) и
 * проверка размера по заголовку (pingImageBlob) до декодирования; формат задаётся явно — HEIC,
 * чтобы ImageMagick не выбирал декодер по содержимому.
 */
final class ImagickHeicConverter implements HeicConverter
{
    private const MEMORY_BYTES = 256 * 1024 * 1024;

    private const MAX_SIDE = 16_384;

    public function toJpeg(string $heic): string
    {
        if (! extension_loaded('imagick') || Imagick::queryFormats('HEIC') === []) {
            throw new UnsupportedHeic('Imagick без поддержки HEIC');
        }

        try {
            $maxPixels = Config::integer('photos.max_pixels');
            Imagick::setResourceLimit(Imagick::RESOURCETYPE_MEMORY, self::MEMORY_BYTES);
            Imagick::setResourceLimit(Imagick::RESOURCETYPE_AREA, $maxPixels);
            if (defined('Imagick::RESOURCETYPE_WIDTH') && defined('Imagick::RESOURCETYPE_HEIGHT')) {
                Imagick::setResourceLimit((int) constant('Imagick::RESOURCETYPE_WIDTH'), self::MAX_SIDE);
                Imagick::setResourceLimit((int) constant('Imagick::RESOURCETYPE_HEIGHT'), self::MAX_SIDE);
            }

            $probe = new Imagick;
            $probe->setFormat('heic');
            $probe->pingImageBlob($heic);
            if (ImageDimensions::tooLarge($probe->getImageWidth(), $probe->getImageHeight())) {
                throw new ImageTooLarge($probe->getImageWidth().'×'.$probe->getImageHeight());
            }
            $probe->clear();

            $image = new Imagick;
            $image->setFormat('heic');
            $image->readImageBlob($heic);
            $image->setImageFormat('jpeg');
            $image->setImageCompressionQuality(92);

            return $image->getImageBlob();
        } catch (ImagickException $e) {
            // Превышен лимит ширины, высоты, площади или памяти — это «слишком большое», а не «не читается».
            throw self::isLimitError($e->getMessage())
                ? new ImageTooLarge($e->getMessage(), previous: $e)
                : new UnsupportedHeic($e->getMessage(), previous: $e);
        }
    }

    /** Ошибка ImageMagick из-за resource limits (`width or height exceeds limit`, `cache resources exhausted`…). */
    public static function isLimitError(string $message): bool
    {
        return preg_match('/exceeds? limit|exceeded|resources? exhausted|memory allocation failed/i', $message) === 1;
    }
}
