<?php

declare(strict_types=1);

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;

/** Имя и город профиля (UC-A2). Другие поля запроса игнорируются: почта и Яндекс ID здесь не меняются. */
final class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'city_id' => ['nullable', 'integer', 'exists:cities,id'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'name.max' => __('account.validation.name_too_long'),
            'name.*' => __('account.validation.name_required'),
            'city_id.*' => __('account.validation.city_invalid'),
        ];
    }

    public function name(): string
    {
        return $this->string('name')->toString();
    }

    public function cityId(): ?int
    {
        return $this->filled('city_id') ? $this->integer('city_id') : null;
    }
}
