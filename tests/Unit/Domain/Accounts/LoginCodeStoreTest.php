<?php

declare(strict_types=1);

use App\Domain\Accounts\EmailLogin\EmailAddress;
use App\Domain\Accounts\EmailLogin\LoginCodeStore;
use Illuminate\Support\Facades\Cache;

beforeEach(function () {
    config(['login.code_store' => 'array', 'login.code_ttl' => 600]);
});

function codeStore(): LoginCodeStore
{
    return app(LoginCodeStore::class);
}

function annaEmail(): EmailAddress
{
    return EmailAddress::from('anna@example.com');
}

it('хранит хэш, а не сам код', function () {
    codeStore()->put(annaEmail(), '482913');

    $raw = Cache::store('array')->get('login:code:'.annaEmail()->key());

    expect($raw)->toBeString()
        ->and($raw)->not->toContain('482913')
        ->and(codeStore()->matches(annaEmail(), '482913'))->toBeTrue();
});

it('неверный код не подходит', function () {
    codeStore()->put(annaEmail(), '482913');

    expect(codeStore()->matches(annaEmail(), '482914'))->toBeFalse();
});

it('код другой почты не подходит', function () {
    codeStore()->put(annaEmail(), '482913');

    expect(codeStore()->matches(EmailAddress::from('boris@example.com'), '482913'))->toBeFalse();
});

it('код действует TTL из конфига и потом истекает', function () {
    $this->freezeTime();
    codeStore()->put(annaEmail(), '482913');

    $this->travel(599)->seconds();
    expect(codeStore()->matches(annaEmail(), '482913'))->toBeTrue();

    $this->travel(2)->seconds();
    expect(codeStore()->matches(annaEmail(), '482913'))->toBeFalse();
});

it('новый код отменяет прежний', function () {
    codeStore()->put(annaEmail(), '111111');
    codeStore()->put(annaEmail(), '222222');

    expect(codeStore()->matches(annaEmail(), '111111'))->toBeFalse()
        ->and(codeStore()->matches(annaEmail(), '222222'))->toBeTrue();
});

it('forget удаляет код', function () {
    codeStore()->put(annaEmail(), '482913');
    codeStore()->forget(annaEmail());

    expect(codeStore()->matches(annaEmail(), '482913'))->toBeFalse();
});
