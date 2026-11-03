<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Accounts\YandexLogin\FakeYandexProvider;
use App\Domain\Accounts\YandexLogin\YandexOAuth;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use Laravel\Socialite\Facades\Socialite;
use SocialiteProviders\Yandex\Provider as YandexProvider;

beforeEach(function () {
    config([
        'services.yandex.fake' => true,
        'services.yandex.client_id' => 'test-client-id',
        'services.yandex.client_secret' => 'test-client-secret',
        'services.yandex.redirect' => 'http://localhost/auth/yandex/callback',
        // Подменный провайдер не ходит в сеть: любой запрос упал бы на пустой очереди ответов.
        'services.yandex.guzzle' => ['handler' => HandlerStack::create(new MockHandler([]))],
    ]);
});

it('закрытый список окружений подменного провайдера — константа: testing и e2e', function () {
    expect(YandexOAuth::FAKE_ENVIRONMENTS)->toBe(['testing', 'e2e']);
});

it('YANDEX_OAUTH_FAKE в окружении :dataset: подменный провайдер входит тестовым пользователем без Яндекса', function (string $env) {
    app()['env'] = $env;
    $user = User::factory()->create(['email' => FakeYandexProvider::USER['default_email'], 'yandex_id' => null]);

    expect(YandexOAuth::fakeEnabled())->toBeTrue()
        ->and(Socialite::driver('yandex'))->toBeInstanceOf(FakeYandexProvider::class);

    $location = (string) $this->get('/auth/yandex/redirect')->assertRedirect()->headers->get('Location');
    expect($location)->toStartWith('/auth/yandex/callback?');

    $this->get($location)->assertRedirect('/');

    $this->assertAuthenticatedAs($user);
    expect($user->fresh()?->yandex_id)->toBe(FakeYandexProvider::USER['id']);
})->with(['testing', 'e2e']);

it('подменный провайдер проверяет state: подделанный → 403', function () {
    $this->get('/auth/yandex/redirect')->assertRedirect();

    $this->get('/auth/yandex/callback?code=fake&state=forged')->assertForbidden();

    $this->assertGuest();
});

it('подменный провайдер: новый пользователь проходит «нужна регистрация»', function () {
    $location = (string) $this->get('/auth/yandex/redirect')->headers->get('Location');

    $this->get($location)->assertRedirect('/');

    expect(session('login_window'))->toBe(['status' => 'registration_required', 'name' => FakeYandexProvider::USER['first_name']]);
});

it('YANDEX_OAUTH_FAKE не действует при APP_ENV :dataset', function (string $env) {
    app()['env'] = $env;

    expect(YandexOAuth::fakeEnabled())->toBeFalse()
        ->and(Socialite::driver('yandex'))->toBeInstanceOf(YandexProvider::class)
        ->and(Socialite::driver('yandex'))->not->toBeInstanceOf(FakeYandexProvider::class);

    $location = (string) $this->get('/auth/yandex/redirect')->assertRedirect()->headers->get('Location');
    expect($location)->toStartWith('https://oauth.yandex.ru/authorize?');
})->with(['local', 'stage', 'production']);

it('YANDEX_OAUTH_FAKE выключен → настоящий провайдер и в testing', function () {
    config(['services.yandex.fake' => false]);

    expect(YandexOAuth::fakeEnabled())->toBeFalse()
        ->and(Socialite::driver('yandex'))->not->toBeInstanceOf(FakeYandexProvider::class);
});
