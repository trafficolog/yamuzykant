<?php

declare(strict_types=1);

namespace App\Support\Observability;

use Monolog\LogRecord;
use Monolog\Processor\ProcessorInterface;

/**
 * Процессор Monolog: маскирует e-mail, коды входа, серийные номера и токены в сообщении, контексте и extra.
 */
final class MaskingProcessor implements ProcessorInterface
{
    private LogMasker $masker;

    public function __construct(?LogMasker $masker = null)
    {
        $this->masker = $masker ?? new LogMasker;
    }

    public function __invoke(LogRecord $record): LogRecord
    {
        /** @var array<string, mixed> $context */
        $context = $this->masker->maskValue($record->context);
        /** @var array<string, mixed> $extra */
        $extra = $this->masker->maskValue($record->extra);

        return $record->with(
            message: $this->masker->mask($record->message),
            context: $context,
            extra: $extra,
        );
    }
}
