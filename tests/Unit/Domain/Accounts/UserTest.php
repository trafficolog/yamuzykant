<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Models\City;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;

it('хранит почту в нижнем регистре', function () {
    $user = User::factory()->create(['email' => '  Anna@Example.COM ']);

    expect($user->fresh()?->email)->toBe('anna@example.com');
});

it('почта уникальна без учёта регистра', function () {
    User::factory()->create(['email' => 'anna@example.com']);

    User::factory()->create(['email' => 'ANNA@example.com']);
})->throws(QueryException::class);

it('yandex_id уникален и может быть пустым у нескольких пользователей', function () {
    User::factory()->count(2)->create(['yandex_id' => null]);
    User::factory()->create(['yandex_id' => '1000001']);

    User::factory()->create(['yandex_id' => '1000001']);
})->throws(QueryException::class);

it('в таблице нет пароля и телефона', function () {
    expect(Schema::hasColumns('users', [
        'email', 'yandex_id', 'name', 'city_id', 'notification_prefs',
        'consent_version', 'consented_at', 'last_login_at',
    ]))->toBeTrue()
        ->and(Schema::hasColumn('users', 'password'))->toBeFalse()
        ->and(Schema::hasColumn('users', 'phone'))->toBeFalse();
});

it('приводит даты, настройки уведомлений и город', function () {
    $city = City::factory()->create(['name' => 'Москва', 'region' => 'Москва']);
    $user = User::factory()->create([
        'city_id' => $city->id,
        'notification_prefs' => ['messages' => true],
        'consented_at' => '2026-11-03 10:00:00',
        'last_login_at' => '2026-11-03 10:05:00',
    ])->fresh();

    expect($user?->consented_at)->toBeInstanceOf(Carbon::class)
        ->and($user?->last_login_at)->toBeInstanceOf(Carbon::class)
        ->and($user?->notification_prefs)->toBe(['messages' => true])
        ->and($user?->city?->name)->toBe('Москва');
});

it('удаление города обнуляет city_id пользователя', function () {
    $city = City::factory()->create();
    $user = User::factory()->create(['city_id' => $city->id]);

    $city->delete();

    expect($user->fresh()?->city_id)->toBeNull();
});

it('не отдаёт почту, yandex_id и служебные поля при сериализации', function () {
    $user = User::factory()->create(['yandex_id' => '1000001']);

    expect($user->toArray())->not->toHaveKeys(['email', 'yandex_id', 'remember_token', 'session_version']);
});
