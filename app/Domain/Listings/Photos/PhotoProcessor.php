<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

use Illuminate\Support\Facades\Config;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\Exceptions\RuntimeException as InterventionException;
use Intervention\Image\ImageManager;
use Intervention\Image\Interfaces\ImageInterface;
use Jenssegers\ImageHash\ImageHash;
use Jenssegers\ImageHash\Implementations\PerceptualHash;

/**
 * Перекодирование фото (ARCHITECTURE §1): Intervention Image 3 на GD — версии 1:1 и 4:3 в WebP и AVIF.
 *
 * EXIF: поворот из EXIF применяется к пикселям (autoOrientation), затем метаданные отбрасываются (strip);
 * кодеры GD метаданные не пишут вовсе. Исходник целиком не попадает ни в одну версию.
 * pHash (DCT, 64 бита) — для будущей автопроверки дублей фото (UC-O1).
 */
final class PhotoProcessor
{
    public function __construct(private readonly HeicConverter $heic) {}

    /**
     * @throws UnreadablePhoto файл не читается как изображение
     * @throws UnsupportedHeic HEIC без декодера
     * @throws ImageTooLarge больше photos.max_pixels — до декодирования
     */
    public function process(string $bytes, ImageType $type): ProcessedPhoto
    {
        if ($type === ImageType::Heic) {
            $bytes = $this->heic->toJpeg($bytes);
        }

        // Размер по заголовку до декодирования: «бомба распаковки» не должна дойти до GD.
        $dimensions = ImageDimensions::of($bytes) ?? throw new UnreadablePhoto('Нет заголовка с размерами');
        if (ImageDimensions::tooLarge(...$dimensions)) {
            throw new ImageTooLarge(implode('×', $dimensions));
        }

        $manager = new ImageManager(new GdDriver, autoOrientation: true, strip: true, decodeAnimation: false);

        try {
            $image = $manager->read($bytes);
        } catch (InterventionException $e) {
            throw new UnreadablePhoto($e->getMessage(), previous: $e);
        }

        // Сначала уменьшаем до минимума, который ещё покрывает каждую версию: дальше работаем с ~2 Мп вместо 12.
        $factor = $this->coverFactor($image);
        if ($factor < 1.0) {
            $image->scale(width: max(1, (int) ceil($image->width() * $factor)));
        }

        $files = [];
        foreach (PhotoVariant::cases() as $variant) {
            $resized = $this->crop(clone $image, $variant);
            $files["{$variant->value}.".PhotoFormat::Webp->value] = (string) $resized->toWebp(quality: Config::integer('photos.quality.webp'), strip: true);
            $files["{$variant->value}.".PhotoFormat::Avif->value] = (string) $resized->toAvif(quality: Config::integer('photos.quality.avif'), strip: true);
        }

        $hash = (new ImageHash(new PerceptualHash, $manager))->hash($files[PhotoVariant::Square->value.'.'.PhotoFormat::Webp->value]);

        return new ProcessedPhoto($files, str_pad($hash->toHex(), 16, '0', STR_PAD_LEFT));
    }

    /**
     * Обрезка по центру до пропорций версии; не больше размера версии и без растягивания маленьких фото.
     */
    private function crop(ImageInterface $image, PhotoVariant $variant): ImageInterface
    {
        [$width, $height] = $variant->size();
        $scale = min(1.0, $image->width() / $width, $image->height() / $height);

        return $image->cover(max(1, (int) floor($width * $scale)), max(1, (int) floor($height * $scale)));
    }

    /** Во сколько раз можно уменьшить фото, чтобы обрезка любой версии осталась в полном размере. */
    private function coverFactor(ImageInterface $image): float
    {
        $factor = 0.0;
        foreach (PhotoVariant::cases() as $variant) {
            [$width, $height] = $variant->size();
            $factor = max($factor, $width / $image->width(), $height / $image->height());
        }

        return min(1.0, $factor);
    }
}
