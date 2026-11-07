<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

use Imagick;
use ImagickException;

/**
 * HEIC → JPEG через Imagick (ImageMagick с libheif). Без расширения или кодека — UnsupportedHeic:
 * фото помечается ошибкой «сохраните как JPEG», а не падает воркер.
 */
final class ImagickHeicConverter implements HeicConverter
{
    public function toJpeg(string $heic): string
    {
        if (! extension_loaded('imagick') || Imagick::queryFormats('HEIC') === []) {
            throw new UnsupportedHeic('Imagick без поддержки HEIC');
        }

        try {
            $image = new Imagick;
            $image->readImageBlob($heic);
            $image->setImageFormat('jpeg');
            $image->setImageCompressionQuality(92);

            return $image->getImageBlob();
        } catch (ImagickException $e) {
            throw new UnsupportedHeic($e->getMessage(), previous: $e);
        }
    }
}
