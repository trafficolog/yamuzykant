<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

/**
 * Выданная, но ещё не подтверждённая загрузка: чья, к какому объявлению, куда и что обещано загрузить.
 */
final readonly class PendingUpload
{
    public function __construct(
        public string $id,
        public string $listingId,
        public int $userId,
        public string $key,
        public string $contentType,
        public int $size,
    ) {}

    /** @return array{id: string, listing_id: string, user_id: int, key: string, content_type: string, size: int} */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'listing_id' => $this->listingId,
            'user_id' => $this->userId,
            'key' => $this->key,
            'content_type' => $this->contentType,
            'size' => $this->size,
        ];
    }

    /** @param  array{id: string, listing_id: string, user_id: int, key: string, content_type: string, size: int}  $data */
    public static function fromArray(array $data): self
    {
        return new self($data['id'], $data['listing_id'], $data['user_id'], $data['key'], $data['content_type'], $data['size']);
    }
}
