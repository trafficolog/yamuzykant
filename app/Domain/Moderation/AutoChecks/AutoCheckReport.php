<?php

declare(strict_types=1);

namespace App\Domain\Moderation\AutoChecks;

use App\Domain\Moderation\Enums\RiskLevel;

/**
 * Итог автопроверок: блокирующие ошибки по полям формы и сигналы риска.
 * Ошибки заполняет ListingAutoChecks::validate(), сигналы — ListingAutoChecks::assess().
 */
final readonly class AutoCheckReport
{
    /**
     * @param  list<Finding>  $blocking
     * @param  list<Finding>  $signals
     */
    public function __construct(
        private array $blocking = [],
        private array $signals = [],
    ) {}

    /**
     * Текст для продавца по полю: ключи совпадают с полями формы (`title`, `description`) — годится
     * для ValidationException::withMessages() и Validator::errors().
     *
     * @return array<string, string>
     */
    public function errors(): array
    {
        $errors = [];
        foreach ($this->blocking as $finding) {
            if ($finding->field !== null && ! isset($errors[$finding->field])) {
                $errors[$finding->field] = $finding->hint ?? $finding->message;
            }
        }

        return $errors;
    }

    public function blocked(): bool
    {
        return $this->blocking !== [];
    }

    /** @return list<Finding> */
    public function signals(): array
    {
        return $this->signals;
    }

    /**
     * Коды сработавших признаков без повторов, в порядке проверок.
     *
     * @return list<string>
     */
    public function codes(): array
    {
        return array_values(array_unique(array_map(static fn (Finding $f): string => $f->code, $this->signals)));
    }

    public function risk(): RiskLevel
    {
        return $this->signals === [] && $this->blocking === [] ? RiskLevel::Normal : RiskLevel::High;
    }
}
