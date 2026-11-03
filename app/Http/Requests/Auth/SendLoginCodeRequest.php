<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use App\Domain\Accounts\EmailLogin\EmailAddress;
use Illuminate\Foundation\Http\FormRequest;

class SendLoginCodeRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email:rfc', 'max:254'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function messages(): array
    {
        return [
            'email.required' => __('login.validation.email_required'),
            'email.*' => __('login.validation.email_invalid'),
        ];
    }

    public function emailAddress(): EmailAddress
    {
        return EmailAddress::from($this->string('email')->toString());
    }
}
