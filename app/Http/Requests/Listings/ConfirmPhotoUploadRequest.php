<?php

declare(strict_types=1);

namespace App\Http\Requests\Listings;

use Illuminate\Foundation\Http\FormRequest;

final class ConfirmPhotoUploadRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'upload_id' => ['required', 'uuid'],
            'serial' => ['sometimes', 'boolean'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['upload_id.*' => (string) __('photos.errors.missing_upload')];
    }

    public function uploadId(): string
    {
        return $this->string('upload_id')->toString();
    }

    public function serial(): bool
    {
        return $this->boolean('serial');
    }
}
