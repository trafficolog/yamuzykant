<?php

declare(strict_types=1);

namespace App\Http\Requests\Messaging;

use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Messaging\MessageBody;
use App\Domain\Messaging\Models\Conversation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Текст сообщения: проверяется после нормализации (MessageBody), чтобы пробелы и невидимые символы
 * не обходили «пусто» и лимит длины.
 */
final class SendMessageRequest extends FormRequest
{
    /**
     * До валидации: чужая беседа и неопубликованное объявление — 404, а не 422 на пустой текст,
     * иначе ответ раскрывал бы, что беседа или объявление существуют.
     */
    public function authorize(): bool
    {
        $conversation = $this->route('conversation');
        if ($conversation instanceof Conversation) {
            return Gate::forUser($this->user())->allows('view', $conversation);
        }

        $listing = $this->route('listing');

        return ! $listing instanceof Listing || $listing->status === ListingStatus::Published;
    }

    protected function failedAuthorization(): never
    {
        throw new NotFoundHttpException;
    }

    protected function prepareForValidation(): void
    {
        $body = $this->input('body');
        if (is_string($body)) {
            $this->merge(['body' => MessageBody::normalize($body)]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'max:'.Config::integer('messaging.max_length')],
            // Ключ идемпотентности отправки (4.1.3): uuid или случайная строка клиента.
            'client_id' => ['nullable', 'string', 'max:64', 'regex:/^[A-Za-z0-9_-]+$/'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'body.required' => (string) __('messaging.validation.required'),
            'body.string' => (string) __('messaging.validation.required'),
            'body.max' => (string) __('messaging.validation.max', ['max' => Config::integer('messaging.max_length')]),
        ];
    }

    public function clientId(): ?string
    {
        $clientId = $this->input('client_id');

        return is_string($clientId) && $clientId !== '' ? $clientId : null;
    }

    public function body(): string
    {
        return $this->string('body')->toString();
    }
}
