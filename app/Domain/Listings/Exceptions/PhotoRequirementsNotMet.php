<?php

declare(strict_types=1);

namespace App\Domain\Listings\Exceptions;

use App\Domain\Listings\Rules\PhotoShortfall;
use RuntimeException;

/**
 * Публикация без нужных фото (BR-03). Текст — список недостающего: «ещё 1 фото, фото серийного номера».
 */
final class PhotoRequirementsNotMet extends RuntimeException
{
    public function __construct(public readonly PhotoShortfall $shortfall)
    {
        parent::__construct(implode(', ', $shortfall->messages()));
    }
}
