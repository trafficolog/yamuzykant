<?php

declare(strict_types=1);

namespace App\Support\Observability;

use Sentry\Breadcrumb;
use Sentry\Event;
use Sentry\EventHint;
use Sentry\UserDataBag;

/**
 * beforeSend для Sentry: перед отправкой убирает ПДн.
 * Из пользователя остаётся только id, из запроса — url без query и безопасные заголовки.
 */
final class SentryScrubber
{
    /** Заголовки, которые безопасно отправлять; остальные отбрасываются. */
    private const SAFE_HEADERS = ['x-request-id', 'user-agent', 'accept', 'accept-language', 'content-type', 'host', 'referer'];

    public static function beforeSend(Event $event, ?EventHint $hint): Event
    {
        $masker = new LogMasker;

        $message = $event->getMessage();
        if ($message !== null) {
            $event->setMessage($masker->mask($message));
        }

        foreach ($event->getExceptions() as $exception) {
            $exception->setValue($masker->mask($exception->getValue()));

            // Аргументы функций (vars) попадают в события при zend.exception_ignore_args=Off — чистим в любом случае.
            foreach ($exception->getStacktrace()?->getFrames() ?? [] as $frame) {
                /** @var array<string, mixed> $vars */
                $vars = $masker->maskValue($frame->getVars());
                $frame->setVars($frame->isInApp() ? self::whitelistVars($vars) : $vars);
            }
        }

        /** @var array<string, string> $tags */
        $tags = $masker->maskValue($event->getTags());
        $event->setTags($tags);

        foreach ($event->getContexts() as $name => $context) {
            /** @var array<string, mixed> $maskedContext */
            $maskedContext = $masker->maskValue($context);
            $event->setContext((string) $name, $maskedContext);
        }

        $user = $event->getUser();
        if ($user !== null) {
            $event->setUser(new UserDataBag($user->getId()));
        }

        $event->setRequest(self::scrubRequest($event->getRequest(), $masker));

        /** @var array<string, mixed> $extra */
        $extra = $masker->maskValue($event->getExtra());
        $event->setExtra($extra);

        $breadcrumbs = array_map(
            fn (Breadcrumb $crumb): Breadcrumb => self::scrubBreadcrumb($crumb, $masker),
            $event->getBreadcrumbs(),
        );
        $event->setBreadcrumb($breadcrumbs);

        return $event;
    }

    /**
     * Аргументы кадров приложения: числа, bool и null остаются; строка остаётся, только если это uuid/ulid
     * или короткое слово-идентификатор (статус, имя класса, enum); любой другой текст — например имя, описание,
     * телефон — заменяется на «[string:длина]». Кадры вендора эту проверку не проходят: там пользовательского текста нет.
     *
     * @param  array<array-key, mixed>  $vars
     * @return array<array-key, mixed>
     */
    private static function whitelistVars(array $vars): array
    {
        $safe = [];

        foreach ($vars as $key => $value) {
            if (is_array($value)) {
                $safe[$key] = self::whitelistVars($value);
            } elseif (is_string($value)) {
                $safe[$key] = self::isSafeString($value) ? $value : '[string:'.strlen($value).']';
            } elseif (is_int($value) || is_float($value) || is_bool($value) || $value === null) {
                $safe[$key] = $value;
            } else {
                // Объекты и прочее: только тип.
                $safe[$key] = '['.get_debug_type($value).']';
            }
        }

        return $safe;
    }

    private static function isSafeString(string $value): bool
    {
        return in_array($value, [LogMasker::MASK, LogMasker::MASKED_EMAIL], true)
            || preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $value) === 1
            || preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/', $value) === 1
            // статус, значение enum, имя очереди: только строчные слова — имена людей так не выглядят
            || preg_match('/^[a-z][a-z_.:-]{0,63}$/', $value) === 1
            // полное имя класса
            || preg_match('/^(?:[A-Z][A-Za-z0-9_]*\\\\)+[A-Z][A-Za-z0-9_]*$/', $value) === 1;
    }

    /**
     * @param  array<string, mixed>  $request
     * @return array<string, mixed>
     */
    private static function scrubRequest(array $request, LogMasker $masker): array
    {
        $clean = [];

        foreach (['method', 'url'] as $field) {
            if (isset($request[$field]) && is_string($request[$field])) {
                $clean[$field] = $masker->mask(explode('?', $request[$field], 2)[0]);
            }
        }

        if (isset($request['headers']) && is_array($request['headers'])) {
            $headers = [];
            foreach ($request['headers'] as $name => $value) {
                if (in_array(strtolower((string) $name), self::SAFE_HEADERS, true)) {
                    $headers[$name] = $masker->maskValue($value);
                }
            }
            $clean['headers'] = $headers;
        }

        // cookies, data, query_string, env намеренно не переносятся.
        return $clean;
    }

    private static function scrubBreadcrumb(Breadcrumb $crumb, LogMasker $masker): Breadcrumb
    {
        $scrubbed = $crumb;

        $message = $crumb->getMessage();
        if ($message !== null) {
            $scrubbed = $scrubbed->withMessage($masker->mask($message));
        }

        foreach ($crumb->getMetadata() as $name => $value) {
            $scrubbed = $scrubbed->withMetadata((string) $name, $masker->maskValue($value, (string) $name));
        }

        return $scrubbed;
    }
}
