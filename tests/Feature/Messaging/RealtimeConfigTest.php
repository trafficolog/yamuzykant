<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Actions\SendMessage;
use Illuminate\Broadcasting\BroadcastManager;
use Illuminate\Support\Facades\Log;
use Inertia\Testing\AssertableInertia;
use Tests\Support\MessagingFixtures;

// 4.1.1: Reverb. Вещателя `log` нет — он писал бы текст сообщений в журнал. Клиентские события выключены:
// участник не может слать в канал ничего мимо сервера.

it('вещатель log ничего не пишет в журнал: переопределён на драйвер null', function () {
    expect(config('broadcasting.connections.log.driver'))->toBe('null')
        ->and(config('broadcasting.connections.reverb.driver'))->toBe('reverb');
});

it('BROADCAST_CONNECTION=log не выводит текст сообщения в журнал', function () {
    config(['scout.driver' => 'null', 'broadcasting.default' => 'log']);
    app(BroadcastManager::class)->forgetDrivers();
    $path = useTempJsonLog();

    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    app(SendMessage::class)->handle($buyer, $conversation, 'Секретная встреча у Сокола');
    Log::info('после отправки');

    expect(implode("\n", readLogLines($path)))->not->toContain('Сокола');
});

it('Reverb: клиентские события (whisper) выключены, источники соединений — из настройки', function () {
    $app = config('reverb.apps.apps.0');

    expect($app['accept_client_events_from'])->toBe('none')
        ->and($app['allowed_origins'])->toBeArray()
        ->and($app['allowed_origins'])->not->toContain('*');
});

it('источники по умолчанию — хост APP_URL', function () {
    $config = require base_path('config/reverb.php');

    expect($config['apps']['apps'][0]['allowed_origins'])->toContain(parse_url((string) config('app.url'), PHP_URL_HOST));
});

it('вошедший получает настройки клиента Reverb без секрета; гость — нет', function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'public-key',
        'broadcasting.connections.reverb.secret' => 'very-secret',
        'broadcasting.client' => ['host' => 'ws.example.test', 'port' => 443, 'scheme' => 'https'],
    ]);

    $this->actingAs(User::factory()->create())->get('/')
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('realtime.key', 'public-key')
            ->where('realtime.host', 'ws.example.test')
            ->where('realtime.port', 443)
            ->where('realtime.scheme', 'https'));

    expect($this->get('/')->getContent())->not->toContain('very-secret');

    auth()->logout();
    $this->get('/')->assertInertia(fn (AssertableInertia $page) => $page->where('realtime', null));
});

it('без Reverb (вещатель null) настроек клиента нет', function () {
    config(['broadcasting.default' => 'null']);

    $this->actingAs(User::factory()->create())->get('/')
        ->assertInertia(fn (AssertableInertia $page) => $page->where('realtime', null));
});
