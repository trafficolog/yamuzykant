<?php

declare(strict_types=1);

use App\Domain\Accounts\EmailLogin\EmailAddress;
use App\Domain\Accounts\EmailLogin\LoginCodeStore;
use Illuminate\Support\Facades\Cache;

beforeEach(function () {
    config(['login.code_store' => 'array', 'login.code_ttl' => 600]);
    $this->store = app(LoginCodeStore::class);
    $this->email = EmailAddress::from('anna@example.com');
});

it('хранит хэш, а не сам код', function () {
    $this->store->put($this->email, '482913');

    $raw = Cache::store('array')->get('login:code:'.$this->email->key());

    expect($raw)->toBeString()
        ->and($raw)->not->toContain('482913')
        ->and($this->store->matches($this->email, '482913'))->toBeTrue();
});

it('неверный код не подходит', function () {
    $this->store->put($this->email, '482913');

    expect($this->store->matches($this->email, '482914'))->toBeFalse();
});

it('код другой почты не подходит', function () {
    $this->store->put($this->email, '482913');

    expect($this->store->matches(EmailAddress::from('boris@example.com'), '482913'))->toBeFalse();
});

it('код действует TTL из конфига и потом истекает', function () {
    $this->freezeTime();
    config(['login.code_ttl' => 600]);
    $this->store->put($this->email, '482913');

    $this->travel(599)->seconds();
    expect($this->store->has($this->email))->toBeTrue();

    $this->travel(2)->seconds();
    expect($this->store->has($this->email))->toBeFalse()
        ->and($this->store->matches($this->email, '482913'))->toBeFalse();
});

it('новый код отменяет прежний', function () {
    $this->store->put($this->email, '111111');
    $this->store->put($this->email, '222222');

    expect($this->store->matches($this->email, '111111'))->toBeFalse()
        ->and($this->store->matches($this->email, '222222'))->toBeTrue();
});

it('forget удаляет код', function () {
    $this->store->put($this->email, '482913');
    $this->store->forget($this->email);

    expect($this->store->has($this->email))->toBeFalse();
});
