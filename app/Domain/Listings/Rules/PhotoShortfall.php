<?php

declare(strict_types=1);

namespace App\Domain\Listings\Rules;

use Illuminate\Support\Facades\Config;

/**
 * Чего не хватает объявлению по фото (BR-03): недостающие фото, фото серийного номера, лишние фото.
 */
final readonly class PhotoShortfall
{
    public function __construct(
        public int $missingPhotos,
        public bool $missingSerial,
        public int $extraPhotos,
    ) {}

    public function satisfied(): bool
    {
        return $this->missingPhotos === 0 && ! $this->missingSerial && $this->extraPhotos === 0;
    }

    /**
     * Для строки «Чтобы опубликовать, добавьте: …» (UC-L1 7a).
     *
     * @return list<string>
     */
    public function messages(): array
    {
        $messages = [];
        if ($this->missingPhotos > 0) {
            $messages[] = (string) __('photos.requirements.more', ['count' => $this->missingPhotos]);
        }
        if ($this->missingSerial) {
            $messages[] = (string) __('photos.requirements.serial');
        }
        if ($this->extraPhotos > 0) {
            $messages[] = (string) __('photos.requirements.fewer', [
                'count' => $this->extraPhotos,
                'max' => Config::integer('photos.max'),
            ]);
        }

        return $messages;
    }
}
