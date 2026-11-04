<?php

declare(strict_types=1);

namespace App\Support\Observability;

use Throwable;

/**
 * Маскирует ПДн и секреты в строках и структурах: e-mail, коды входа, серийные номера, токены.
 * Один набор правил для журналов (MaskingProcessor) и для Sentry (SentryScrubber).
 */
final class LogMasker
{
    public const MASK = '[masked]';

    public const MASKED_EMAIL = '[email]';

    /** Ключи контекста, значение которых скрывается целиком. */
    private const SENSITIVE_KEY = '/(^|[_\-.])(code|otp|pin|authorization|cookie|dsn)([_\-.]|$)|serial|token|password|passwd|secret|api[_\-]?key/i';

    public function mask(string $text): string
    {
        $patterns = [
            // e-mail
            '/[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}/u' => self::MASKED_EMAIL,
            // Bearer-токены
            '/\b(Bearer)\s+[A-Za-z0-9._~+\/=\-]+/i' => '$1 '.self::MASK,
            // код входа / otp рядом со словом: «код: 123456», "code=123456"
            '/\b(code|код|otp)(\W{0,3})\d{4,8}\b/iu' => '$1$2'.self::MASK,
            // серийный номер: «серийный номер: A123», «S/N 998877», «serial: X1»
            '/((?:серийн\w*(?:\s+номер\w*)?|serial(?:[\s_]number)?|s\/n)\W{0,3})[\p{L}\p{N}\-]{4,}/iu' => '$1'.self::MASK,
            // токены, пароли и ключи в виде key=value / key: value
            '/\b([\w\-]*(?:token|password|passwd|secret|api[_\-]?key)[\w\-]*)(\s*[=:]\s*)[^\s,;&"\']+/i' => '$1$2'.self::MASK,
        ];

        $result = preg_replace(array_keys($patterns), array_values($patterns), $text);

        return $result ?? $text;
    }

    /**
     * @param  mixed  $value  значение любого типа; объекты, кроме исключений, не разбираются
     */
    public function maskValue(mixed $value, ?string $key = null): mixed
    {
        if ($key !== null && is_scalar($value) && $value !== '' && preg_match(self::SENSITIVE_KEY, $key) === 1) {
            return self::MASK;
        }

        if (is_string($value)) {
            return $this->mask($value);
        }

        if (is_array($value)) {
            $masked = [];
            foreach ($value as $k => $item) {
                $masked[$k] = $this->maskValue($item, is_string($k) ? $k : null);
            }

            return $masked;
        }

        if ($value instanceof Throwable) {
            return [
                'class' => $value::class,
                'message' => $this->mask($value->getMessage()),
                'exception_code' => $value->getCode(),
                'file' => $value->getFile(),
                'line' => $value->getLine(),
                'trace' => $this->mask($value->getTraceAsString()),
            ];
        }

        return $value;
    }
}
