<?php

declare(strict_types=1);

namespace Tests\Support;

use GdImage;
use RuntimeException;

/**
 * Фикстуры фото генерируются в тесте: мегабайты в репозиторий не кладём.
 */
final class ImageFixtures
{
    /** Метка в EXIF фикстуры: по ней видно, что метаданные исходника попали в отдаваемую версию. */
    public const EXIF_MARKER = 'YM-GPS-FIXTURE';

    /** JPEG из GD с полосами разных цветов (у однотонной картинки нет деталей для pHash). */
    public static function jpeg(int $width = 1200, int $height = 900, int $quality = 85): string
    {
        $image = self::canvas($width, $height);

        return self::encodeJpeg($image, $quality);
    }

    public static function png(int $width = 800, int $height = 600): string
    {
        $image = self::canvas($width, $height);
        ob_start();
        imagepng($image);

        return (string) ob_get_clean();
    }

    /**
     * JPEG с EXIF: Make = EXIF_MARKER и GPS (55°45′N, 37°37′E — Москва).
     */
    public static function jpegWithGps(int $width = 1200, int $height = 900): string
    {
        return self::insertApp1(self::jpeg($width, $height), self::exifWithGps());
    }

    /** Фото 12 Мп (4000 × 3000). */
    public static function jpeg12mp(): string
    {
        return self::jpeg(4000, 3000, 90);
    }

    /** PDF, который загрузили под именем photo.jpg. */
    public static function pdf(): string
    {
        return "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
            ."2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n";
    }

    /** Начало контейнера HEIC (ftyp heic): по содержимому это image/heic. */
    public static function heicHeader(): string
    {
        $ftyp = pack('N', 24).'ftypheic'.pack('N', 0).'mif1heic';

        return $ftyp.str_repeat("\0", 256);
    }

    /** Настоящий HEIC — только если Imagick умеет кодировать HEIC; иначе null. */
    public static function realHeic(int $width = 1200, int $height = 900): ?string
    {
        if (! extension_loaded('imagick') || \Imagick::queryFormats('HEIC') === []) {
            return null;
        }

        try {
            $imagick = new \Imagick;
            $imagick->readImageBlob(self::jpeg($width, $height));
            $imagick->setImageFormat('heic');
            $blob = $imagick->getImageBlob();
        } catch (\ImagickException) {
            return null;
        }

        return $blob === '' ? null : $blob;
    }

    /**
     * «Бомба распаковки»: PNG, у которого в заголовке IHDR $width × $height, а данных — пара килобайт.
     * Размер файла крошечный, а декодирование заняло бы гигабайты памяти.
     */
    public static function pngBomb(int $width = 20000, int $height = 20000): string
    {
        $chunk = static fn (string $type, string $data): string => pack('N', strlen($data)).$type.$data.pack('N', crc32($type.$data));
        $ihdr = pack('NNCCCCC', $width, $height, 8, 2, 0, 0, 0);
        $idat = (string) gzcompress(str_repeat("\0", 2048));

        return "\x89PNG\r\n\x1a\n".$chunk('IHDR', $ihdr).$chunk('IDAT', $idat).$chunk('IEND', '');
    }

    /** Байты JPEG длиной больше $bytes: валидная сигнатура и хвост из нулей. */
    public static function oversized(int $bytes): string
    {
        $head = self::jpeg(64, 64);

        return $head.str_repeat("\0", max(0, $bytes - strlen($head) + 1));
    }

    private static function canvas(int $width, int $height): GdImage
    {
        $width = max(1, $width);
        $height = max(1, $height);
        $image = imagecreatetruecolor($width, $height);
        if ($image === false) {
            throw new RuntimeException('GD не создал изображение');
        }

        mt_srand($width * 7 + $height);
        $stripes = 48;
        $stripeWidth = (int) ceil($width / $stripes);
        for ($i = 0; $i < $stripes; $i++) {
            $color = (int) imagecolorallocate($image, mt_rand(0, 255), mt_rand(0, 255), mt_rand(0, 255));
            imagefilledrectangle($image, $i * $stripeWidth, 0, ($i + 1) * $stripeWidth, $height, $color);
        }
        for ($i = 0; $i < 200; $i++) {
            $color = (int) imagecolorallocate($image, mt_rand(0, 255), mt_rand(0, 255), mt_rand(0, 255));
            imageline($image, mt_rand(0, $width), mt_rand(0, $height), mt_rand(0, $width), mt_rand(0, $height), $color);
        }

        return $image;
    }

    private static function encodeJpeg(GdImage $image, int $quality): string
    {
        ob_start();
        imagejpeg($image, null, $quality);

        return (string) ob_get_clean();
    }

    /** Сегмент APP1 сразу после SOI. */
    private static function insertApp1(string $jpeg, string $tiff): string
    {
        $payload = "Exif\0\0".$tiff;
        $segment = "\xFF\xE1".pack('n', strlen($payload) + 2).$payload;

        return substr($jpeg, 0, 2).$segment.substr($jpeg, 2);
    }

    /** TIFF little-endian: IFD0 (Make, GPSInfo) → GPS IFD (широта, долгота). */
    private static function exifWithGps(): string
    {
        $make = self::EXIF_MARKER."\0";               // 15 байт
        $ifd0Offset = 8;
        $ifd0Size = 2 + 2 * 12 + 4;                   // 30
        $makeOffset = $ifd0Offset + $ifd0Size;        // 38
        $gpsOffset = $makeOffset + strlen($make) + 1; // 54, выравнивание по чётному
        $gpsSize = 2 + 4 * 12 + 4;                    // 54
        $latOffset = $gpsOffset + $gpsSize;           // 108
        $lonOffset = $latOffset + 24;                 // 132

        $entry = static fn (int $tag, int $type, int $count, string $value): string => pack('vvV', $tag, $type, $count).str_pad($value, 4, "\0");

        $tiff = 'II'.pack('v', 42).pack('V', $ifd0Offset);
        $tiff .= pack('v', 2)
            .$entry(0x010F, 2, strlen($make), pack('V', $makeOffset))
            .$entry(0x8825, 4, 1, pack('V', $gpsOffset))
            .pack('V', 0);
        $tiff .= $make."\0";
        $tiff .= pack('v', 4)
            .$entry(0x0001, 2, 2, "N\0")
            .$entry(0x0002, 5, 3, pack('V', $latOffset))
            .$entry(0x0003, 2, 2, "E\0")
            .$entry(0x0004, 5, 3, pack('V', $lonOffset))
            .pack('V', 0);
        $tiff .= pack('V6', 55, 1, 45, 1, 0, 1);
        $tiff .= pack('V6', 37, 1, 37, 1, 0, 1);

        return $tiff;
    }
}
