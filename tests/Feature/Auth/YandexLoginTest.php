<?php

declare(strict_types=1);

use App\Domain\Accounts\Mail\LoginCodeMail;
use App\Domain\Accounts\Models\User;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Psr\Http\Message\RequestInterface;

const YANDEX_CANCELLED = 'Вход через Яндекс ID отменён. Войдите по почте или попробуйте ещё раз';

// Socialite::fake не проверяет state: параметры нужны, только чтобы запрос был ответом OAuth.
const SOCIALITE_FAKE_CALLBACK = '/auth/yandex/callback?code=fake-code&state=fake-state';

beforeEach(function () {
    Mail::fake();
    config([
        'login.code_fake' => null,
        // CI задаёт YANDEX_OAUTH_FAKE=true для Pest: здесь проверяется настоящий провайдер.
        'services.yandex.fake' => false,
        'services.yandex.client_id' => 'test-client-id',
        'services.yandex.client_secret' => 'test-client-secret',
        'services.yandex.redirect' => 'http://localhost/auth/yandex/callback',
    ]);
});

/**
 * Пользователь, которого «вернул» Яндекс ID (Socialite::fake): поля login.yandex.ru/info.
 *
 * @param  array<string, mixed>  $info
 */
function fakeYandexUser(array $info): void
{
    $user = (new SocialiteUser)->setRaw($info)->map([
        'id' => $info['id'],
        'nickname' => $info['login'] ?? null,
        'name' => $info['real_name'] ?? null,
        'email' => $info['default_email'] ?? null,
    ]);

    Socialite::fake('yandex', $user);
}

/**
 * Начинает вход через настоящий провайдер и возвращает параметры адреса авторизации Яндекса.
 *
 * @return array<string, string>
 */
function startYandexLogin(string $query = ''): array
{
    $location = (string) currentTest()->get('/auth/yandex/redirect'.$query)->assertRedirect()->headers->get('Location');
    parse_str((string) parse_url($location, PHP_URL_QUERY), $params);

    /** @var array<string, string> $params */
    return $params;
}

/**
 * Подменяет HTTP Яндекса для настоящего провайдера: ответ на обмен кода и login.yandex.ru/info.
 *
 * @param  array<int, Response>  $responses
 * @return ArrayObject<int, array<mixed>>
 */
function mockYandexHttp(array $responses): ArrayObject
{
    /** @var ArrayObject<int, array<mixed>> $history */
    $history = new ArrayObject;
    $stack = HandlerStack::create(new MockHandler($responses));
    // history() принимает контейнер по ссылке; объект тот же, поэтому записи видны через $history.
    $container = $history;
    $stack->push(Middleware::history($container));

    config(['services.yandex.guzzle' => ['handler' => $stack]]);

    return $history;
}

/**
 * N-й запрос к Яндексу из истории mockYandexHttp().
 *
 * @param  ArrayObject<int, array<mixed>>  $history
 */
function yandexRequest(ArrayObject $history, int $index): RequestInterface
{
    $request = $history[$index]['request'] ?? null;

    if (! $request instanceof RequestInterface) {
        throw new LogicException("Запроса к Яндексу #{$index} не было");
    }

    return $request;
}

function yandexTokenResponse(): Response
{
    return new Response(200, ['Content-Type' => 'application/json'], (string) json_encode([
        'access_token' => 'y0_SECRET-ACCESS-TOKEN',
        'refresh_token' => '1:SECRET-REFRESH-TOKEN',
        'token_type' => 'bearer',
        'expires_in' => 31_536_000,
    ]));
}

/**
 * @param  array<string, mixed>  $info
 */
function yandexInfoResponse(array $info): Response
{
    return new Response(200, ['Content-Type' => 'application/json'], (string) json_encode($info));
}

// --- OAuth: адрес авторизации, state, PKCE ---

it('ведёт на oauth.yandex.ru со scopes login:email и login:info, state, PKCE S256 и адресом возврата из конфига', function () {
    $response = $this->get('/auth/yandex/redirect')->assertRedirect();
    $location = (string) $response->headers->get('Location');
    parse_str((string) parse_url($location, PHP_URL_QUERY), $params);
    /** @var array<string, string> $params */
    expect($location)->toStartWith('https://oauth.yandex.ru/authorize?')
        ->and($params['response_type'])->toBe('code')
        ->and($params['client_id'])->toBe('test-client-id')
        ->and($params['redirect_uri'])->toBe('http://localhost/auth/yandex/callback')
        ->and(explode(' ', $params['scope']))->toEqualCanonicalizing(['login:email', 'login:info'])
        ->and($params['state'])->toHaveLength(40)
        ->and($params['state'])->toBe(session('state'))
        ->and($params['code_challenge_method'])->toBe('S256')
        ->and($params['code_challenge'])->toBe(
            rtrim(strtr(base64_encode(hash('sha256', (string) session('code_verifier'), true)), '+/', '-_'), '='),
        );
});

it('адрес возврата Яндексу — только из конфига, не из запроса', function () {
    $params = startYandexLogin('?redirect_uri=https://evil.example/callback');

    expect($params['redirect_uri'])->toBe('http://localhost/auth/yandex/callback');
});

it('полный вход: код меняется на токен с code_verifier, токены Яндекса нигде не хранятся', function () {
    $user = User::factory()->create(['email' => 'anna@example.com', 'yandex_id' => '1000001']);
    $history = mockYandexHttp([
        yandexTokenResponse(),
        yandexInfoResponse(['id' => '1000001', 'login' => 'anna', 'first_name' => 'Анна', 'default_email' => 'anna@example.com']),
    ]);
    $params = startYandexLogin();
    $verifier = (string) session('code_verifier');

    $this->get('/auth/yandex/callback?code=auth-code-1&state='.$params['state'])->assertRedirect('/');

    $this->assertAuthenticatedAs($user);
    parse_str((string) yandexRequest($history, 0)->getBody(), $tokenFields);
    expect((string) yandexRequest($history, 0)->getUri())->toBe('https://oauth.yandex.ru/token')
        ->and($tokenFields['code'])->toBe('auth-code-1')
        ->and($tokenFields['code_verifier'])->toBe($verifier)
        ->and($tokenFields['redirect_uri'])->toBe('http://localhost/auth/yandex/callback')
        ->and(session()->has('state'))->toBeFalse()
        ->and(session()->has('code_verifier'))->toBeFalse();

    $stored = json_encode(session()->all()).json_encode(DB::table('users')->get());
    expect($stored)->not->toContain('SECRET-ACCESS-TOKEN')
        ->and($stored)->not->toContain('SECRET-REFRESH-TOKEN');
});

it('неверный state → 403, без входа и без обращения к Яндексу', function (?string $state) {
    User::factory()->create(['email' => 'anna@example.com', 'yandex_id' => '1000001']);
    $history = mockYandexHttp([yandexTokenResponse(), yandexInfoResponse(['id' => '1000001'])]);
    startYandexLogin();

    $query = $state === null ? 'code=auth-code-1' : 'code=auth-code-1&state='.$state;
    $this->get('/auth/yandex/callback?'.$query)->assertForbidden();

    $this->assertGuest();
    expect($history)->toHaveCount(0);
})->with([
    'чужой state' => ['a-forged-state-value-of-forty-characters'],
    'пустой state' => [''],
    'без state' => [null],
]);

it('callback без начатого входа (state нет в сессии) → 403', function () {
    $history = mockYandexHttp([yandexTokenResponse(), yandexInfoResponse(['id' => '1000001'])]);

    $this->get('/auth/yandex/callback?code=auth-code-1&state=any-state')->assertForbidden();

    $this->assertGuest();
    expect($history)->toHaveCount(0);
});

it('адрес callback без параметров OAuth → окно входа, без входа и без обращения к Яндексу; начатый вход не сбрасывается', function () {
    $history = mockYandexHttp([]);
    $params = startYandexLogin();

    $this->get('/auth/yandex/callback')->assertRedirect('/');

    $this->assertGuest();
    expect(session('login_window'))->toBe(['status' => 'yandex_cancelled', 'message' => YANDEX_CANCELLED])
        ->and(session('state'))->toBe($params['state'])
        ->and($history)->toHaveCount(0);
});

it('повторно использованный state → 403, без входа', function () {
    User::factory()->create(['email' => 'anna@example.com', 'yandex_id' => '1000001']);
    mockYandexHttp([
        yandexTokenResponse(),
        yandexInfoResponse(['id' => '1000001', 'default_email' => 'anna@example.com']),
        yandexTokenResponse(),
        yandexInfoResponse(['id' => '1000001', 'default_email' => 'anna@example.com']),
    ]);
    $params = startYandexLogin();
    $this->get('/auth/yandex/callback?code=auth-code-1&state='.$params['state'])->assertRedirect('/');
    auth()->logout();

    $this->get('/auth/yandex/callback?code=auth-code-1&state='.$params['state'])->assertForbidden();

    $this->assertGuest();
});

// --- Привязка аккаунта ---

it('вход по yandex_id: тот же аккаунт, даже если почта в Яндексе другая', function () {
    $this->freezeSecond();
    $user = User::factory()->create(['email' => 'anna@example.com', 'yandex_id' => '1000001', 'last_login_at' => null]);
    fakeYandexUser(['id' => '1000001', 'first_name' => 'Анна', 'default_email' => 'anna.new@yandex.ru']);

    $this->get(SOCIALITE_FAKE_CALLBACK)->assertRedirect('/');

    $this->assertAuthenticatedAs($user);
    expect(User::query()->count())->toBe(1)
        ->and($user->fresh()?->email)->toBe('anna@example.com')
        ->and($user->fresh()?->last_login_at?->equalTo(now()))->toBeTrue()
        ->and(session('auth.session_version'))->toBe(0);
});

it('пользователь, который входил по почте, входит через Яндекс ID в тот же аккаунт: Яндекс ID привязывается', function () {
    // Сначала вход по коду на почту (1.1.1).
    $user = User::factory()->create(['email' => 'anna@example.com', 'yandex_id' => null]);
    $code = requestLoginCode('anna@example.com');
    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])->assertOk();
    $this->post('/auth/logout')->assertOk();

    fakeYandexUser(['id' => '1000001', 'first_name' => 'Анна', 'default_email' => 'Anna@Example.com']);
    $this->get(SOCIALITE_FAKE_CALLBACK)->assertRedirect('/');

    $this->assertAuthenticatedAs($user);
    expect(User::query()->count())->toBe(1)
        ->and($user->fresh()?->yandex_id)->toBe('1000001');
});

it('чужой yandex_id у аккаунта с той же почтой не перезаписывается', function () {
    $user = User::factory()->create(['email' => 'anna@example.com', 'yandex_id' => '1000001']);
    fakeYandexUser(['id' => '2000002', 'default_email' => 'anna@example.com']);

    $this->get(SOCIALITE_FAKE_CALLBACK)->assertRedirect('/');

    expect($user->fresh()?->yandex_id)->toBe('1000001')
        ->and(User::query()->count())->toBe(1);
});

it('новый пользователь: «нужна регистрация» с именем из Яндекса, аккаунт не создаётся до согласия', function () {
    fakeYandexUser(['id' => '3000003', 'first_name' => 'Борис', 'real_name' => 'Борис Петров', 'default_email' => 'boris@yandex.ru']);

    $this->get(SOCIALITE_FAKE_CALLBACK)->assertRedirect('/');

    $this->assertGuest();
    expect(User::query()->count())->toBe(0)
        ->and(session('login_window'))->toBe(['status' => 'registration_required', 'name' => 'Борис'])
        ->and(session('auth.pending_registration.email'))->toBe('boris@yandex.ru')
        ->and(session('auth.pending_registration.yandex_id'))->toBe('3000003');

    $this->postJson('/auth/register', ['name' => 'Борис', 'consent' => true])
        ->assertOk()
        ->assertJsonPath('status', 'authenticated');

    $user = User::query()->sole();
    $this->assertAuthenticatedAs($user);
    expect($user->email)->toBe('boris@yandex.ru')
        ->and($user->yandex_id)->toBe('3000003')
        ->and($user->name)->toBe('Борис');
});

it('имя для шага регистрации — first_name, иначе real_name, иначе display_name', function (array $info, ?string $name) {
    fakeYandexUser(['id' => '3000003', 'default_email' => 'boris@yandex.ru', ...$info]);

    $this->get(SOCIALITE_FAKE_CALLBACK)->assertRedirect('/');

    expect(session('login_window.name'))->toBe($name);
})->with([
    'first_name' => [['first_name' => 'Борис', 'real_name' => 'Борис Петров'], 'Борис'],
    'real_name' => [['real_name' => 'Борис Петров', 'display_name' => 'boris'], 'Борис Петров'],
    'display_name' => [['display_name' => 'boris'], 'boris'],
    'ничего' => [[], null],
]);

it('вход через Яндекс ID не затрагивается лимитами неверных кодов', function () {
    config(['login.limits.max_failed_attempts_per_email' => 3]);
    $user = User::factory()->create(['email' => 'anna@example.com']);
    $code = requestLoginCode('anna@example.com');
    foreach (range(1, 3) as $ignored) {
        $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => wrongLoginCode($code)]);
    }
    $this->postJson('/auth/email/verify', ['email' => 'anna@example.com', 'code' => $code])->assertStatus(429);

    fakeYandexUser(['id' => '1000001', 'default_email' => 'anna@example.com']);
    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.10'])->get(SOCIALITE_FAKE_CALLBACK)->assertRedirect('/');

    $this->assertAuthenticatedAs($user);
});

// --- Отказ и ошибки Яндекса ---

it('отказ у Яндекса → возврат в окно входа с текстом, без входа', function () {
    $history = mockYandexHttp([]);
    $params = startYandexLogin('?return=/sell');

    $this->get('/auth/yandex/callback?error=access_denied&error_description=user+denied&state='.$params['state'])
        ->assertRedirect('/sell');

    $this->assertGuest();
    expect(session('login_window'))->toBe(['status' => 'yandex_cancelled', 'message' => YANDEX_CANCELLED])
        ->and(session()->has('state'))->toBeFalse()
        ->and(session()->has('code_verifier'))->toBeFalse()
        ->and($history)->toHaveCount(0);
});

it('отказ с неверным state → 403', function () {
    startYandexLogin();

    $this->get('/auth/yandex/callback?error=access_denied&state=forged')->assertForbidden();

    $this->assertGuest();
});

/** @param array<int, Response> $responses */
it('ошибка Яндекса при обмене кода или чтении профиля → возврат в окно входа с текстом', function (array $responses) {
    User::factory()->create(['email' => 'anna@example.com', 'yandex_id' => '1000001']);
    mockYandexHttp($responses);
    $params = startYandexLogin();

    $this->get('/auth/yandex/callback?code=bad-code&state='.$params['state'])->assertRedirect('/');

    $this->assertGuest();
    expect(session('login_window'))->toBe(['status' => 'yandex_cancelled', 'message' => YANDEX_CANCELLED]);
})->with([
    'код не принят' => [[new Response(400, [], '{"error":"invalid_grant","error_description":"Code has expired"}')]],
    'Яндекс недоступен' => [[new Response(503, [], 'Service Unavailable')]],
    'профиль недоступен' => [[yandexTokenResponse(), new Response(401, [], '{"error":"unauthorized"}')]],
    'профиль без id' => [[yandexTokenResponse(), yandexInfoResponse(['login' => 'anna'])]],
]);

it('отказ показывается в окне входа на следующей странице (prop login)', function () {
    $params = startYandexLogin();
    $this->get('/auth/yandex/callback?error=access_denied&state='.$params['state']);

    $this->get('/')->assertInertia(fn (Assert $page) => $page
        ->where('login', ['status' => 'yandex_cancelled', 'message' => YANDEX_CANCELLED]));
});

// --- Возврат к действию и открытый редирект ---

it('после входа возвращает к прерванному действию; внешний адрес возврата заменяется на главную', function (string $return, string $expected) {
    User::factory()->create(['email' => 'anna@example.com', 'yandex_id' => '1000001']);
    fakeYandexUser(['id' => '1000001', 'default_email' => 'anna@example.com']);

    $this->get('/auth/yandex/redirect?return='.urlencode($return))->assertRedirect();
    $this->get(SOCIALITE_FAKE_CALLBACK)->assertRedirect($expected);

    $this->assertAuthenticated();
})->with([
    'относительный путь' => ['/sell?step=2', '/sell?step=2'],
    'свой абсолютный URL' => ['http://localhost/account/favorites', '/account/favorites'],
    'чужой хост' => ['https://evil.example/phish', '/'],
    'protocol-relative' => ['//evil.example/phish', '/'],
    'обратный слэш' => ['/\evil.example', '/'],
    'javascript:' => ['javascript:alert(1)', '/'],
]);

it('url.intended с внешним адресом (от middleware auth) тоже заменяется на главную', function () {
    User::factory()->create(['email' => 'anna@example.com', 'yandex_id' => '1000001']);
    fakeYandexUser(['id' => '1000001', 'default_email' => 'anna@example.com']);

    $this->withSession(['url.intended' => 'https://evil.example/phish'])
        ->get(SOCIALITE_FAKE_CALLBACK)
        ->assertRedirect('/');
});

// --- Данные наружу ---

it('yandex_id и почта не уходят на фронт других пользователей', function () {
    $anna = User::factory()->create(['email' => 'anna@example.com', 'yandex_id' => '1000001']);
    $boris = User::factory()->create(['email' => 'boris@example.com']);
    fakeYandexUser(['id' => '1000001', 'default_email' => 'anna@example.com']);
    $this->get(SOCIALITE_FAKE_CALLBACK)->assertRedirect('/');
    $this->assertAuthenticatedAs($anna);
    $this->post('/auth/logout')->assertOk();

    $this->actingAs($boris)->get('/')
        ->assertOk()
        ->assertDontSee('anna@example.com')
        ->assertDontSee('1000001');

    expect($anna->toArray())->not->toHaveKeys(['email', 'yandex_id']);
});

it('ответы шагов входа через Яндекс не содержат почту и yandex_id', function () {
    fakeYandexUser(['id' => '3000003', 'first_name' => 'Борис', 'default_email' => 'boris@yandex.ru']);
    $this->get(SOCIALITE_FAKE_CALLBACK);

    $this->get('/')
        ->assertDontSee('boris@yandex.ru')
        ->assertDontSee('3000003')
        ->assertInertia(fn (Assert $page) => $page->where('login', ['status' => 'registration_required', 'name' => 'Борис']));
});

it('вошедшего пользователя вход через Яндекс не переключает на другой аккаунт', function () {
    $anna = User::factory()->create(['email' => 'anna@example.com']);
    User::factory()->create(['email' => 'boris@example.com', 'yandex_id' => '2000002']);
    fakeYandexUser(['id' => '2000002', 'default_email' => 'boris@example.com']);

    $this->actingAs($anna)->get(SOCIALITE_FAKE_CALLBACK)->assertRedirect('/');

    $this->assertAuthenticatedAs($anna);
});

// --- Яндекс не отдал почту: шаг «Введите почту» с кодом (1.1.1) ---

it('Яндекс не отдал почту → шаг «Введите почту», в users ничего', function (?string $email) {
    fakeYandexUser(['id' => '4000004', 'first_name' => 'Вера', 'default_email' => $email]);

    $this->get(SOCIALITE_FAKE_CALLBACK)->assertRedirect('/');

    $this->assertGuest();
    expect(session('login_window'))->toBe(['status' => 'email_required'])
        ->and(User::query()->count())->toBe(0);
})->with([
    'нет почты' => [null],
    'пустая' => [''],
    'не адрес' => ['not-an-email'],
]);

it('шаг «Введите почту»: почта подтверждена кодом → Яндекс ID привязан к аккаунту с этой почтой', function () {
    $user = User::factory()->create(['email' => 'vera@example.com', 'yandex_id' => null]);
    fakeYandexUser(['id' => '4000004', 'first_name' => 'Вера']);
    $this->get(SOCIALITE_FAKE_CALLBACK);

    $this->postJson('/auth/yandex/email/code', ['email' => 'vera@example.com'])->assertStatus(202);
    /** @var LoginCodeMail $mail */
    $mail = Mail::queued(LoginCodeMail::class)->last();

    $this->postJson('/auth/yandex/email/verify', ['email' => 'vera@example.com', 'code' => $mail->code])
        ->assertOk()
        ->assertExactJson(['status' => 'authenticated', 'redirect' => '/']);

    $this->assertAuthenticatedAs($user);
    expect($user->fresh()?->yandex_id)->toBe('4000004');
});

it('шаг «Введите почту»: новая почта → регистрация с именем и Яндекс ID', function () {
    fakeYandexUser(['id' => '4000004', 'first_name' => 'Вера']);
    $this->get(SOCIALITE_FAKE_CALLBACK);

    $this->postJson('/auth/yandex/email/code', ['email' => 'vera@example.com'])->assertStatus(202);
    /** @var LoginCodeMail $mail */
    $mail = Mail::queued(LoginCodeMail::class)->last();
    $this->postJson('/auth/yandex/email/verify', ['email' => 'vera@example.com', 'code' => $mail->code])
        ->assertOk()
        ->assertExactJson(['status' => 'registration_required', 'name' => 'Вера']);

    $this->postJson('/auth/register', ['name' => 'Вера', 'consent' => true])->assertOk();

    expect(User::query()->sole()->yandex_id)->toBe('4000004');
});

it('шаг «Введите почту»: неверный код → 422, Яндекс ID не привязывается', function () {
    User::factory()->create(['email' => 'vera@example.com', 'yandex_id' => null]);
    fakeYandexUser(['id' => '4000004']);
    $this->get(SOCIALITE_FAKE_CALLBACK);
    $this->postJson('/auth/yandex/email/code', ['email' => 'vera@example.com'])->assertStatus(202);
    /** @var LoginCodeMail $mail */
    $mail = Mail::queued(LoginCodeMail::class)->last();

    $this->postJson('/auth/yandex/email/verify', ['email' => 'vera@example.com', 'code' => wrongLoginCode($mail->code)])
        ->assertStatus(422);

    $this->assertGuest();
    expect(User::query()->sole()->yandex_id)->toBeNull();
});

it('шаг «Введите почту» без входа через Яндекс → 409 с текстом, код не отправляется', function (string $uri, array $payload) {
    $this->postJson($uri, $payload)
        ->assertStatus(409)
        ->assertJsonPath('message', YANDEX_CANCELLED);

    Mail::assertNothingQueued();
})->with([
    'код' => ['/auth/yandex/email/code', ['email' => 'vera@example.com']],
    'проверка' => ['/auth/yandex/email/verify', ['email' => 'vera@example.com', 'code' => '123456']],
]);

it('обычный вход по почте сбрасывает ожидающий Яндекс ID: чужой Яндекс ID не привязывается', function () {
    $user = User::factory()->create(['email' => 'boris@example.com', 'yandex_id' => null]);
    fakeYandexUser(['id' => '4000004']);
    $this->get(SOCIALITE_FAKE_CALLBACK);

    $code = requestLoginCode('boris@example.com');
    $this->postJson('/auth/email/verify', ['email' => 'boris@example.com', 'code' => $code])->assertOk();

    $this->assertAuthenticatedAs($user);
    expect($user->fresh()?->yandex_id)->toBeNull();
});

it('ожидающий Яндекс ID истекает вместе с TTL кода', function () {
    $this->freezeSecond();
    User::factory()->create(['email' => 'vera@example.com']);
    fakeYandexUser(['id' => '4000004']);
    $this->get(SOCIALITE_FAKE_CALLBACK);

    $this->travel(601)->seconds();

    $this->postJson('/auth/yandex/email/code', ['email' => 'vera@example.com'])->assertStatus(409);
});
