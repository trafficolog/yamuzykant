<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

/**
 * Формат отдаваемой версии: AVIF для современных браузеров, WebP — запасной (<picture>).
 */
enum PhotoFormat: string
{
    case Avif = 'avif';
    case Webp = 'webp';

    public function mime(): string
    {
        return 'image/'.$this->value;
    }
}
