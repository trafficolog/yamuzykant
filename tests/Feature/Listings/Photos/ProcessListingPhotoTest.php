<?php

declare(strict_types=1);

use App\Domain\Listings\Jobs\ProcessListingPhoto;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\Models\ListingPhoto;
use App\Domain\Listings\Photos\HeicConverter;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Storage;
use Tests\Support\ImageFixtures;

// BR-03: перекодирование 1:1 и 4:3 в WebP и AVIF, без EXIF, pHash; исходник не отдаётся и удаляется.

beforeEach(function () {
    config(['scout.driver' => 'null']);
    Storage::fake(config('photos.disk'));
});

function photosDisk(): Filesystem
{
    return Storage::disk(config('photos.disk'));
}

/** Фото «загружено и подтверждено»: исходник лежит по upload_key. */
function uploadedPhoto(string $bytes): ListingPhoto
{
    $listing = Listing::factory()->create();
    $key = "uploads/{$listing->id}/".fake()->uuid();
    photosDisk()->put($key, $bytes);

    return ListingPhoto::query()->create([
        'listing_id' => $listing->id,
        'path' => "photos/{$listing->id}/".fake()->uuid(),
        'position' => 0,
        'is_serial' => true,
        'upload_key' => $key,
    ]);
}

/**
 * Ширина и высота картинки из хранилища фото.
 *
 * @return array{int, int}
 */
function storedImageSize(string $path): array
{
    $size = getimagesizefromstring((string) photosDisk()->get($path));
    if ($size === false) {
        throw new RuntimeException("Не картинка: {$path}");
    }

    return [$size[0], $size[1]];
}

function runPhotoJob(ListingPhoto $photo): ListingPhoto
{
    app()->call([new ProcessListingPhoto($photo->id), 'handle']);

    return $photo->refresh();
}

/**
 * Чанки RIFF-контейнера WebP.
 *
 * @return list<string>
 */
function webpChunks(string $bytes): array
{
    expect(substr($bytes, 0, 4))->toBe('RIFF')->and(substr($bytes, 8, 4))->toBe('WEBP');
    $chunks = [];
    $offset = 12;
    while ($offset + 8 <= strlen($bytes)) {
        $chunks[] = substr($bytes, $offset, 4);
        $unpacked = unpack('V', substr($bytes, $offset + 4, 4));
        $size = is_array($unpacked) ? (int) $unpacked[1] : strlen($bytes);
        $offset += 8 + $size + ($size % 2);
    }

    return $chunks;
}

it('файл с GPS в EXIF: в отдаваемых версиях EXIF нет, исходник удалён', function () {
    $source = ImageFixtures::jpegWithGps(1600, 1200);
    expect($source)->toContain(ImageFixtures::EXIF_MARKER);
    $photo = uploadedPhoto($source);
    $original = $photo->upload_key;

    $photo = runPhotoJob($photo);

    expect($photo->processed_at)->not->toBeNull()
        ->and($photo->failed_reason)->toBeNull()
        ->and($photo->upload_key)->toBeNull()
        ->and(photosDisk()->exists((string) $original))->toBeFalse();

    foreach (['square', 'wide'] as $variant) {
        $webp = (string) photosDisk()->get("{$photo->path}/{$variant}.webp");
        $avif = (string) photosDisk()->get("{$photo->path}/{$variant}.avif");

        expect(array_intersect(webpChunks($webp), ['EXIF', 'XMP ']))->toBe([]);
        foreach ([$webp, $avif] as $bytes) {
            expect($bytes)->not->toContain(ImageFixtures::EXIF_MARKER)
                ->and($bytes)->not->toContain("Exif\0\0");
        }
        expect(substr($avif, 4, 8))->toBe('ftypavif');
    }
});

it('версии 1:1 и 4:3 в WebP и AVIF нужных размеров', function () {
    $photo = runPhotoJob(uploadedPhoto(ImageFixtures::jpeg(3000, 2000)));

    $square = storedImageSize("{$photo->path}/square.webp");
    $wide = storedImageSize("{$photo->path}/wide.webp");
    expect($square)->toBe([800, 800])
        ->and($wide)->toBe([1600, 1200]);

    expect(photosDisk()->exists("{$photo->path}/square.avif"))->toBeTrue()
        ->and(photosDisk()->exists("{$photo->path}/wide.avif"))->toBeTrue();
});

it('маленькое фото не растягивается: пропорции 1:1 и 4:3 сохраняются', function () {
    $photo = runPhotoJob(uploadedPhoto(ImageFixtures::png(400, 300)));

    $square = storedImageSize("{$photo->path}/square.webp");
    $wide = storedImageSize("{$photo->path}/wide.webp");
    expect($square[0])->toBe($square[1])->toBeLessThanOrEqual(400)
        ->and($wide[0] * 3)->toBe($wide[1] * 4)
        ->and($wide[0])->toBeLessThanOrEqual(400);
});

it('считает perceptual hash: у похожих фото он близок, у разных — далёк', function () {
    $a = runPhotoJob(uploadedPhoto(ImageFixtures::jpeg(1200, 900)));
    $sameScaled = runPhotoJob(uploadedPhoto(ImageFixtures::jpeg(1200, 900, 60)));
    $other = runPhotoJob(uploadedPhoto(ImageFixtures::jpeg(900, 1200)));

    expect($a->phash)->toMatch('/^[0-9a-f]{16}$/');
    // Расстояние Хэмминга по 16 шестнадцатеричным знакам (64 бита не влезают в int со знаком).
    $distance = fn (string $x, string $y): int => array_sum(array_map(
        fn (string $p, string $q): int => substr_count(decbin(hexdec($p) ^ hexdec($q)), '1'),
        str_split($x),
        str_split($y),
    ));
    expect($distance((string) $a->phash, (string) $sameScaled->phash))->toBeLessThan(10)
        ->and($distance((string) $a->phash, (string) $other->phash))->toBeGreaterThan(10);
});

it('фото 12 Мп готово к показу не дольше 10 с', function () {
    $photo = uploadedPhoto(ImageFixtures::jpeg12mp());

    $started = hrtime(true);
    $photo = runPhotoJob($photo);
    $seconds = (hrtime(true) - $started) / 1e9;

    fwrite(STDERR, sprintf("\n  обработка 12 Мп: %.2f с\n", $seconds));
    expect($photo->processed_at)->not->toBeNull()
        ->and($seconds)->toBeLessThanOrEqual(10.0);
});

it('HEIC → JPEG перед перекодированием', function () {
    $converter = new class implements HeicConverter
    {
        public int $calls = 0;

        public function toJpeg(string $heic): string
        {
            $this->calls++;

            return ImageFixtures::jpeg(1200, 900);
        }
    };
    app()->instance(HeicConverter::class, $converter);

    $photo = runPhotoJob(uploadedPhoto(ImageFixtures::heicHeader()));

    expect($converter->calls)->toBe(1)
        ->and($photo->processed_at)->not->toBeNull()
        ->and(photosDisk()->exists("{$photo->path}/wide.avif"))->toBeTrue();
});

it('настоящий HEIC через Imagick', function () {
    $heic = ImageFixtures::realHeic();
    if ($heic === null) {
        $this->markTestSkipped('Imagick без кодека HEIC: '.(extension_loaded('imagick') ? 'нет формата HEIC' : 'нет расширения imagick'));
    }

    $photo = runPhotoJob(uploadedPhoto($heic));

    expect($photo->processed_at)->not->toBeNull()
        ->and(photosDisk()->exists("{$photo->path}/square.webp"))->toBeTrue();
});

it('битый файл — фото помечено ошибкой, исходник удалён', function () {
    $photo = uploadedPhoto(substr(ImageFixtures::jpeg(), 0, 200));

    $photo = runPhotoJob($photo);

    expect($photo->processed_at)->toBeNull()
        ->and($photo->failed_reason)->toBe('unreadable')
        ->and(photosDisk()->allFiles())->toBe([]);
});

it('бомба распаковки (PNG 20000 × 20000) — ошибка без декодирования, исходник удалён', function () {
    // Декодирование 20000 × 20000 в GD — больше 1,6 ГБ: если размер не проверить по заголовку, процесс упадёт.
    $photo = runPhotoJob(uploadedPhoto(ImageFixtures::pngBomb(20000, 20000)));

    expect($photo->failed_reason)->toBe('dimensions')
        ->and($photo->processed_at)->toBeNull()
        ->and($photo->upload_key)->toBeNull()
        ->and(photosDisk()->allFiles())->toBe([]);
});

it('неожиданное исключение в job — фото с ошибкой, исходник удалён (failed)', function () {
    app()->instance(HeicConverter::class, new class implements HeicConverter
    {
        public function toJpeg(string $heic): string
        {
            throw new RuntimeException('сбой декодера');
        }
    });
    $photo = uploadedPhoto(ImageFixtures::heicHeader());

    // Очередь sync: исключение уходит наружу, а Laravel вызывает failed() у job.
    expect(fn () => ProcessListingPhoto::dispatch($photo->id))->toThrow(RuntimeException::class);

    $photo->refresh();
    expect($photo->failed_reason)->toBe('unreadable')
        ->and($photo->upload_key)->toBeNull()
        ->and(photosDisk()->allFiles())->toBe([]);
});

it('failed() не трогает уже готовое фото', function () {
    $photo = runPhotoJob(uploadedPhoto(ImageFixtures::jpeg()));

    (new ProcessListingPhoto($photo->id))->failed(new RuntimeException('поздний сбой'));

    expect($photo->refresh()->failed_reason)->toBeNull()
        ->and($photo->processed_at)->not->toBeNull();
});

it('лимит памяти поднимается только на время job', function () {
    $before = (string) ini_get('memory_limit');
    ini_set('memory_limit', '256M');

    runPhotoJob(uploadedPhoto(ImageFixtures::jpeg()));

    expect(ini_get('memory_limit'))->toBe('256M');
    ini_set('memory_limit', $before);
});

it('удалённое до обработки фото job пропускает', function () {
    $photo = uploadedPhoto(ImageFixtures::jpeg());
    $photo->delete();

    app()->call([new ProcessListingPhoto($photo->id), 'handle']);

    expect(photosDisk()->allFiles())->toHaveCount(1);
});

it('job идёт в очереди с ограничением времени и повторами', function () {
    $job = new ProcessListingPhoto(1);

    expect($job)->toBeInstanceOf(ShouldQueue::class)
        ->and($job->timeout)->toBeGreaterThan(10)
        ->and($job->tries)->toBeGreaterThanOrEqual(1);
});
