<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Tests\Support\RequestIdProbeJob;

it('ответ содержит X-Request-Id, а без входящего заголовка id генерируется', function () {
    $id = $this->get('/')->headers->get('X-Request-Id');

    expect($id)->toBeString()->toMatch('/^[A-Za-z0-9-]{8,64}$/');
});

it('принимает корректный входящий X-Request-Id', function () {
    $this->withHeader('X-Request-Id', 'edge-abc123')->get('/health')
        ->assertHeader('X-Request-Id', 'edge-abc123');
});

it('подменяет некорректный входящий X-Request-Id', function () {
    $response = $this->withHeader('X-Request-Id', 'bad id <script>')->get('/health');
    $id = (string) $response->headers->get('X-Request-Id');

    expect($id)->toMatch('/^[A-Za-z0-9-]{8,64}$/');
    expect($id)->not->toContain('script');
});

it('каждая запись журнала запроса содержит request_id', function () {
    $path = useTempJsonLog();
    Route::get('/_test/log', function () {
        Log::info('внутри запроса');

        return 'ok';
    });

    $this->withHeader('X-Request-Id', 'req-log-0001')->get('/_test/log')->assertOk();

    $records = array_map(fn (string $l): array => json_decode($l, true, 512, JSON_THROW_ON_ERROR), readLogLines($path));
    $record = collect($records)->firstWhere('message', 'внутри запроса');

    expect($record)->not->toBeNull();
    expect(json_encode($record))->toContain('req-log-0001');
});

it('в событиях из задания очереди есть тег Sentry request_id из Context', function () {
    config(['queue.default' => 'database']);
    Context::add('request_id', 'req-tag-0001');
    dispatch(new RequestIdProbeJob);

    Context::flush();
    RequestIdProbeJob::$seen = null;
    RequestIdProbeJob::$sentryTag = null;
    Artisan::call('queue:work', ['--once' => true, '--stop-when-empty' => true]);

    expect(RequestIdProbeJob::$sentryTag)->toBe('req-tag-0001');
});

it('тег request_id не переходит в следующее задание без request_id', function () {
    config(['queue.default' => 'database']);
    Context::add('request_id', 'req-first-0001');
    dispatch(new RequestIdProbeJob);
    Context::flush();
    dispatch(new RequestIdProbeJob);

    $tags = [];
    foreach ([1, 2] as $_) {
        RequestIdProbeJob::$sentryTag = 'unset';
        Artisan::call('queue:work', ['--once' => true, '--stop-when-empty' => true]);
        $tags[] = RequestIdProbeJob::$sentryTag;
    }

    expect($tags)->toBe(['req-first-0001', null]);
});

it('страница отдаёт request_id в meta для событий Sentry в браузере', function () {
    $this->withHeader('X-Request-Id', 'req-meta-0001')->get('/')
        ->assertSee('<meta name="request-id" content="req-meta-0001">', false);
});

it('request_id пробрасывается в задание очереди и виден в его контексте', function () {
    config(['queue.default' => 'database']);
    Context::add('request_id', 'req-job-0001');

    dispatch(new RequestIdProbeJob);

    expect((string) DB::table('jobs')->value('payload'))->toContain('req-job-0001');

    Context::flush();
    RequestIdProbeJob::$seen = null;
    Artisan::call('queue:work', ['--once' => true, '--stop-when-empty' => true]);

    expect(RequestIdProbeJob::$seen)->toBe('req-job-0001');
});
