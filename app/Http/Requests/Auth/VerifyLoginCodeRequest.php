<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

class VerifyLoginCodeRequest extends SendLoginCodeRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function messages(): array
    {
        return [
            ...parent::messages(),
            'code.*' => __('login.validation.code_invalid'),
        ];
    }

    public function code(): string
    {
        return $this->string('code')->toString();
    }
}
