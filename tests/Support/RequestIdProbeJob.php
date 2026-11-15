<?php

declare(strict_types=1);

namespace Tests\Support;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Context;
use Sentry\Event;
use Sentry\SentrySdk;
use Sentry\State\Scope;

/**
 * Тестовое задание: запоминает request_id, с которым оно выполнилось.
 */
final class RequestIdProbeJob implements ShouldQueue
{
    use Queueable;

    public static ?string $seen = null;

    /** Тег Sentry request_id в области видимости задания. */
    public static ?string $sentryTag = null;

    public function handle(): void
    {
        $id = Context::get('request_id');
        self::$seen = is_string($id) ? $id : null;

        self::$sentryTag = null;
        SentrySdk::getCurrentHub()->configureScope(static function (Scope $scope): void {
            $tag = $scope->applyToEvent(Event::createEvent())?->getTags()['request_id'] ?? null;
            self::$sentryTag = is_string($tag) ? $tag : null;
        });
    }
}
