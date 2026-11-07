<?php

declare(strict_types=1);

use App\Support\Observability\SentryScrubber;
use Tests\TestCase;

uses()->group(TestCase::NO_DATABASE_GROUP);

it('без DSN Sentry выключен', function () {
    expect(config('sentry.dsn'))->toBeNull();

    $client = app('sentry')->getClient();
    expect($client?->getOptions()->getDsn())->toBeNull();
});

it('Sentry не отправляет ПДн по умолчанию и фильтрует события через beforeSend', function () {
    expect(config('sentry.send_default_pii'))->toBeFalse()
        ->and(config('sentry.before_send'))->toBe([SentryScrubber::class, 'beforeSend']);
});

it('release задаётся переменной SENTRY_RELEASE (git sha)', function () {
    expect(config('sentry'))->toHaveKey('release');
});
