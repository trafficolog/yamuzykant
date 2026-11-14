<?php

declare(strict_types=1);

namespace App\Http\Requests\Account;

use App\Domain\Notifications\Enums\NotificationKind;
use Illuminate\Foundation\Http\FormRequest;

/** Настройки писем: по одному логическому полю на каждый вид уведомления; чужие ключи игнорируются. */
final class UpdateNotificationsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $rules = [];
        foreach (NotificationKind::cases() as $kind) {
            $rules[$kind->value] = ['required', 'boolean'];
        }

        return $rules;
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        $messages = [];
        foreach (NotificationKind::cases() as $kind) {
            $messages[$kind->value.'.*'] = __('account.validation.notification_invalid');
        }

        return $messages;
    }

    /** @return array<string, bool> */
    public function changes(): array
    {
        $changes = [];
        foreach (NotificationKind::cases() as $kind) {
            $changes[$kind->value] = $this->boolean($kind->value);
        }

        return $changes;
    }
}
