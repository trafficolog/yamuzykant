<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use App\Domain\Accounts\Data\RegistrationData;
use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'city_id' => ['nullable', 'integer', 'exists:cities,id'],
            'consent' => ['accepted'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function messages(): array
    {
        return [
            'name.max' => __('login.validation.name_too_long'),
            'name.*' => __('login.validation.name_required'),
            'city_id.*' => __('login.validation.city_invalid'),
            'consent.*' => __('login.validation.consent_required'),
        ];
    }

    public function toData(): RegistrationData
    {
        return new RegistrationData(
            name: $this->string('name')->toString(),
            cityId: $this->filled('city_id') ? $this->integer('city_id') : null,
            consent: $this->boolean('consent'),
        );
    }
}
