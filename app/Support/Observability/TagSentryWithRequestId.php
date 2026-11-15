<?php

declare(strict_types=1);

namespace App\Support\Observability;

use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Support\Facades\Context;
use Sentry\State\Scope;

use function Sentry\configureScope;

/**
 * Тег Sentry `request_id` для заданий очереди: id приходит в Context вместе с заданием (Laravel гидрирует Context
 * на JobProcessing раньше этого слушателя), а в области видимости воркера его нет. Область Sentry на время задания
 * открывает интеграция sentry-laravel, поэтому тег не «протекает» в следующее задание.
 */
final class TagSentryWithRequestId
{
    public function handle(JobProcessing $event): void
    {
        $id = Context::get('request_id');

        // Задание без request_id (расписание, ручной запуск) не должно унаследовать тег предыдущего.
        configureScope(static function (Scope $scope) use ($id): void {
            if (is_string($id) && $id !== '') {
                $scope->setTag('request_id', $id);
            } else {
                $scope->removeTag('request_id');
            }
        });
    }
}
