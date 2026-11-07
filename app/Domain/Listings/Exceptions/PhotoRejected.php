<?php

declare(strict_types=1);

namespace App\Domain\Listings\Exceptions;

use RuntimeException;

/**
 * Ожидаемый отказ при работе с фото (422): поле формы и причина — ключ текста `photos.errors.*`.
 */
final class PhotoRejected extends RuntimeException
{
    private function __construct(public readonly string $field, public readonly string $reason)
    {
        parent::__construct((string) __("photos.errors.{$reason}"));
    }

    public static function notImage(): self
    {
        return new self('upload_id', 'not_image');
    }

    public static function tooLarge(): self
    {
        return new self('upload_id', 'size');
    }

    public static function tooManyPixels(): self
    {
        return new self('upload_id', 'dimensions');
    }

    public static function missingUpload(): self
    {
        return new self('upload_id', 'missing_upload');
    }

    public static function tooMany(): self
    {
        return new self('photos', 'too_many');
    }

    public static function serialExists(): self
    {
        return new self('serial', 'serial_exists');
    }

    public static function publishedMinimum(): self
    {
        return new self('photos', 'published_minimum');
    }

    public static function staleOrder(): self
    {
        return new self('photos', 'order');
    }
}
