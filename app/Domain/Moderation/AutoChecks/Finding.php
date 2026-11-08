<?php

declare(strict_types=1);

namespace App\Domain\Moderation\AutoChecks;

/**
 * Результат одной проверки: код проверки, поле формы, пояснение модератору и (для блокирующих проверок)
 * подсказка продавцу. Детали (найденный фрагмент, расстояние pHash, медиана) — для модератора, не для продавца.
 */
final readonly class Finding
{
    /**
     * @param  array<string, mixed>  $details
     */
    public function __construct(
        public string $code,
        public ?string $field,
        public string $message,
        public array $details = [],
        public ?string $hint = null,
    ) {}

    /**
     * Вид для хранения в moderation_flags.signals.
     *
     * @return array{code: string, field: string|null, message: string, details: array<string, mixed>}
     */
    public function toArray(): array
    {
        return ['code' => $this->code, 'field' => $this->field, 'message' => $this->message, 'details' => $this->details];
    }
}
