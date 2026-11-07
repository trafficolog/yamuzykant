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
                $frame->setVars($vars);
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
