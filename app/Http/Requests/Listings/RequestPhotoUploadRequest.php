<?php

declare(strict_types=1);

namespace App\Http\Requests\Listings;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Config;
use Illuminate\Validation\Rule;

/**
 * Запрос URL загрузки: заявленные тип и размер (BR-03). После загрузки тип проверяется по содержимому.
 */
final class RequestPhotoUploadRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'content_type' => ['required', 'string', Rule::in(Config::array('photos.types'))],
            'size' => ['required', 'integer', 'min:1', 'max:'.Config::integer('photos.max_bytes')],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'content_type.*' => (string) __('photos.errors.type'),
            'size.*' => (string) __('photos.errors.size'),
        ];
    }

    public function contentType(): string
    {
        return $this->string('content_type')->toString();
    }

    public function size(): int
    {
        return $this->integer('size');
    }
}
