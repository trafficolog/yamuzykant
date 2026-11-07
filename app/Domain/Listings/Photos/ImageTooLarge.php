<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

use RuntimeException;

/** Больше photos.max_pixels — фото не декодируется. */
final class ImageTooLarge extends RuntimeException {}
