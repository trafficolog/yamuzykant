<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Tests\Support\RequestIdProbeJob;

beforeEach(function () {
    $this->logPath = sys_get_temp_dir().'/ym-rid-'.uniqid().'.log';
    config([
        'logging.default' => 'single',
        'logging.channels.single.path' => $this->logPath,
    ]);
    Log::forgetChannel('single');
});

afterEach(function () {
    @unlink($this->logPath);
});

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

    expect($response->headers->get('X-Request-Id'))->toMatch('/^[A-Za-z0-9-]{8,64}$/')->not->toContain('script');
});

it('каждая запись журнала запроса содержит request_id', function () {
    Route::get('/_test/log', function () {
        Log::info('внутри запроса');

        return 'ok';
    });

    $this->withHeader('X-Request-Id', 'req-log-0001')->get('/_test/log')->assertOk();
    Log::forgetChannel('single');

    $lines = file($this->logPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $records = array_map(fn (string $l) => json_decode($l, true), $lines);
    $record = collect($records)->firstWhere('message', 'внутри запроса');

    expect($record)->not->toBeNull()
        ->and(json_encode($record))->toContain('req-log-0001');
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
