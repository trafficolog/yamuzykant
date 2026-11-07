<?php

declare(strict_types=1);

namespace App\Domain\Listings\Photos;

/**
 * Результат перекодирования: байты версий по ключу «{variant}.{format}» и perceptual hash (16 hex).
 */
final readonly class ProcessedPhoto
{
    /**
     * @param  array<string, string>  $files
     */
    public function __construct(
        public array $files,
        public string $phash,
    ) {}
}
