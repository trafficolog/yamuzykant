<?php

declare(strict_types=1);

namespace Tests\Support;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Context;

/**
 * Тестовое задание: запоминает request_id, с которым оно выполнилось.
 */
final class RequestIdProbeJob implements ShouldQueue
{
    use Queueable;

    public static ?string $seen = null;

    public function handle(): void
    {
        $id = Context::get('request_id');
        self::$seen = is_string($id) ? $id : null;
    }
}
