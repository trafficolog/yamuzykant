<?php

declare(strict_types=1);

namespace App\Support\Observability;

use Illuminate\Log\Logger;
use Monolog\Formatter\JsonFormatter;
use Monolog\Handler\FormattableHandlerInterface;
use Monolog\Logger as MonologLogger;

/**
 * Tap канала журнала: JSON (одна запись — одна строка) и маскирование ПДн.
 * Контекст запроса (request_id) Laravel кладёт в extra записи.
 */
final class JsonLogTap
{
    public function __invoke(Logger $logger): void
    {
        $monolog = $logger->getLogger();

        if (! $monolog instanceof MonologLogger) {
            return;
        }

        foreach ($monolog->getHandlers() as $handler) {
            if ($handler instanceof FormattableHandlerInterface) {
                $handler->setFormatter(new JsonFormatter(JsonFormatter::BATCH_MODE_NEWLINES, true));
            }
        }

        // Tap выполняется раньше, чем LogManager добавляет процессор контекста Laravel; Monolog запускает
        // процессоры от последнего добавленного к первому, поэтому маскирование видит и контекст.
        $monolog->pushProcessor(new MaskingProcessor);
    }
}
