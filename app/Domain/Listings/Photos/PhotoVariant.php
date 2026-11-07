<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

use Illuminate\Support\Facades\Config;

/**
 * Отдаваемая версия фото (ARCHITECTURE §1): 1:1 и 4:3. Размеры — config photos.variants.
 */
enum PhotoVariant: string
{
    case Square = 'square';
    case Wide = 'wide';

    /** @return array{int, int} ширина и высота */
    public function size(): array
    {
        /** @var array{int, int} $size */
        $size = Config::array("photos.variants.{$this->value}");

        return [(int) $size[0], (int) $size[1]];
    }
}
