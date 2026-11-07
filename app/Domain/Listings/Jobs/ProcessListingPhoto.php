<?php

declare(strict_types=1);

namespace App\Domain\Listings\Jobs;

use App\Domain\Listings\Models\ListingPhoto;
use App\Domain\Listings\Photos\ImageTooLarge;
use App\Domain\Listings\Photos\ImageType;
use App\Domain\Listings\Photos\PhotoProcessor;
use App\Domain\Listings\Photos\PhotoStorage;
use App\Domain\Listings\Photos\UnreadablePhoto;
use App\Domain\Listings\Photos\UnsupportedHeic;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Перекодирование загруженного фото (AGENTS.md §4: всё дольше 200 мс — в очереди).
 * После обработки исходник (с EXIF и геоданными) удаляется: хранятся и отдаются только версии без EXIF.
 * Любой исход заканчивается состоянием фото: готово или ошибка с причиной — после всех попыток
 * это делает failed(), чтобы фото не висело «в обработке», а исходник не оставался в бакете.
 */
final class ProcessListingPhoto implements ShouldQueue
{
    use Queueable;

    /** Лимит памяти на время одной job: 12 Мп в GD — около 50 МБ на кадр, плюс копии при обработке. */
    private const MEMORY_LIMIT = '512M';

    /** Критерий 2.1.2 — готово к показу ≤ 10 с; запас на медленный воркер. */
    public int $timeout = 60;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [5, 30];

    public function __construct(public readonly int $photoId) {}

    public function handle(PhotoProcessor $processor): void
    {
        $photo = ListingPhoto::query()->find($this->photoId);
        if ($photo === null || $photo->upload_key === null) {
            return; // фото удалили или уже обработали
        }

        $disk = PhotoStorage::disk();
        $source = $disk->get($photo->upload_key);
        $type = $source === null ? null : ImageType::sniff(substr($source, 0, ImageType::SNIFF_BYTES));
        if ($source === null || $type === null) {
            $this->markFailed($photo, 'unreadable');

            return;
        }

        $previousLimit = $this->raiseMemory(self::MEMORY_LIMIT);
        try {
            $result = $processor->process($source, $type);
        } catch (ImageTooLarge) {
            $this->markFailed($photo, 'dimensions');

            return;
        } catch (UnreadablePhoto) {
            $this->markFailed($photo, 'unreadable');

            return;
        } catch (UnsupportedHeic) {
            $this->markFailed($photo, 'heic_unsupported');

            return;
        } finally {
            unset($source);
            if ($previousLimit !== null) {
                @ini_set('memory_limit', $previousLimit);
            }
        }

        foreach ($result->files as $name => $bytes) {
            $disk->put("{$photo->path}/{$name}", $bytes);
        }

        $disk->delete($photo->upload_key);
        $photo->forceFill([
            'upload_key' => null,
            'phash' => $result->phash,
            'processed_at' => now(),
            'failed_reason' => null,
        ])->save();
    }

    /** Попытки кончились (сбой хранилища, кодека, нехватка ресурсов): фото — ошибка, исходник удаляется. */
    public function failed(?Throwable $exception = null): void
    {
        $photo = ListingPhoto::query()->find($this->photoId);
        if ($photo === null || $photo->isReady() || $photo->isFailed()) {
            return;
        }

        $this->markFailed($photo, 'unreadable');
    }

    private function markFailed(ListingPhoto $photo, string $reason): void
    {
        if ($photo->upload_key !== null) {
            PhotoStorage::disk()->delete($photo->upload_key);
        }
        $photo->forceFill(['upload_key' => null, 'failed_reason' => $reason])->save();
    }

    /** Поднять лимит памяти на время job; возвращает прежний, если менял. */
    private function raiseMemory(string $limit): ?string
    {
        $current = (string) ini_get('memory_limit');
        if ($current === '-1' || $this->bytes($current) >= $this->bytes($limit)) {
            return null;
        }
        ini_set('memory_limit', $limit);

        return $current;
    }

    private function bytes(string $value): int
    {
        $number = (int) $value;

        return match (strtoupper(substr(trim($value), -1))) {
            'G' => $number * 1024 ** 3,
            'M' => $number * 1024 ** 2,
            'K' => $number * 1024,
            default => $number,
        };
    }
}
