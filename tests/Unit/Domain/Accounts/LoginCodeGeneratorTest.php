<?php

declare(strict_types=1);

use App\Domain\Accounts\EmailLogin\LoginCodeGenerator;

beforeEach(function () {
    config(['login.code_fake' => null]);
});

it('генерирует код из 6 цифр', function () {
    $generator = new LoginCodeGenerator;

    foreach (range(1, 50) as $ignored) {
        expect($generator->generate())->toMatch('/^\d{6}$/');
    }
});

it('коды случайные, с ведущими нулями', function () {
    $generator = new LoginCodeGenerator;

    $codes = collect(range(1, 200))->map(fn () => $generator->generate());

    expect($codes->unique()->count())->toBeGreaterThan(190)
        ->and($codes->every(fn (string $code) => strlen($code) === 6))->toBeTrue();
});

it('LOGIN_CODE_FAKE задаёт фиксированный код в окружении :dataset', function (string $env) {
    app()['env'] = $env;
    config(['login.code_fake' => '123456']);

    $generator = new LoginCodeGenerator;

    expect($generator->fakeCode())->toBe('123456')
        ->and($generator->generate())->toBe('123456');
})->with(['testing', 'e2e']);

it('LOGIN_CODE_FAKE не действует при APP_ENV :dataset', function (string $env) {
    app()['env'] = $env;
    config(['login.code_fake' => '123456']);

    $generator = new LoginCodeGenerator;
    $codes = collect(range(1, 20))->map(fn () => $generator->generate());

    expect($generator->fakeCode())->toBeNull()
        ->and($codes->unique()->count())->toBeGreaterThan(1)
        ->and($codes->every(fn (string $code) => preg_match('/^\d{6}$/', $code) === 1))->toBeTrue();
})->with(['local', 'stage', 'production']);

it('LOGIN_CODE_FAKE не из 6 цифр игнорируется', function (string $fake) {
    app()['env'] = 'testing';
    config(['login.code_fake' => $fake]);

    expect((new LoginCodeGenerator)->fakeCode())->toBeNull();
})->with(['12345', '1234567', 'abcdef', '']);
