<?php

declare(strict_types=1);

namespace App\Http\Requests\Catalog;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Вход проверяет middleware `auth` на маршруте, здесь только данные. */
final class SuggestModelRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'text' => ['required', 'string', 'min:3', 'max:120', 'regex:/^\S+\s+\S.*$/u'],
            'category_id' => ['required', 'integer', Rule::exists('categories', 'id')->where('is_visible', true)],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'text.regex' => 'Укажите бренд и модель, например «Fender Stratocaster».',
        ];
    }
}
