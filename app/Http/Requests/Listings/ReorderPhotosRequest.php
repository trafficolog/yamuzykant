<?php

declare(strict_types=1);

namespace App\Http\Requests\Listings;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Config;

final class ReorderPhotosRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'photos' => ['required', 'array', 'max:'.(Config::integer('photos.max') * 2)],
            'photos.*' => ['integer', 'distinct'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['photos.*' => (string) __('photos.errors.order')];
    }

    /** @return list<int> */
    public function ids(): array
    {
        /** @var array<int, int|string> $ids */
        $ids = $this->input('photos', []);

        return array_values(array_map(intval(...), $ids));
    }
}
