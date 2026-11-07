<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

use Illuminate\Contracts\Cache\Repository;
use Illuminate\Support\Facades\Config;

/**
 * Невыполненные загрузки в кэше (Redis): подтвердить можно только выданную этому пользователю
 * загрузку к этому объявлению и только один раз (pull).
 */
final class PendingPhotoUploads
{
    private const PREFIX = 'listing-photo-upload:';

    public function __construct(private readonly Repository $cache) {}

    public function put(PendingUpload $upload): void
    {
        $this->cache->put(self::PREFIX.$upload->id, $upload->toArray(), Config::integer('photos.confirm_ttl'));
    }

    public function find(string $id): ?PendingUpload
    {
        return $this->hydrate($this->cache->get(self::PREFIX.$id));
    }

    /**
     * Забрать загрузку ровно один раз. Repository::pull() — это get() и forget() без атомарности,
     * поэтому захват засчитывается только тому, чей forget() действительно удалил ключ (в Redis — DEL
     * с результатом 1). Параллельный запрос с тем же upload_id получает null.
     */
    public function pull(string $id): ?PendingUpload
    {
        $upload = $this->hydrate($this->cache->get(self::PREFIX.$id));
        if ($upload === null || ! $this->cache->forget(self::PREFIX.$id)) {
            return null;
        }

        return $upload;
    }

    private function hydrate(mixed $data): ?PendingUpload
    {
        if (! is_array($data)) {
            return null;
        }

        /** @var array{id: string, listing_id: string, user_id: int, key: string, content_type: string, size: int} $data */
        return PendingUpload::fromArray($data);
    }
}
