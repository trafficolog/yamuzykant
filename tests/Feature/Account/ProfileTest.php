<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Models\City;
use Database\Seeders\CitySeeder;
use Inertia\Testing\AssertableInertia as Assert;

// 1.1.3 (UC-A2): кабинет — «Обзор» и «Профиль». Имя, город, почта (только себе), Яндекс ID, уведомления.

beforeEach(function () {
    $this->seed(CitySeeder::class);
});

function cityByName(string $name): City
{
    return City::query()->where('name', $name)->firstOrFail();
}

it('гостя с любой страницы кабинета отправляет на главную', function () {
    $this->get('/account')->assertRedirect('/');
    $this->get('/account/profile')->assertRedirect('/');
    $this->patch('/account/profile', ['name' => 'Анна'])->assertRedirect('/');
    $this->put('/account/notifications', ['new_message' => false])->assertRedirect('/');
});

it('профиль: имя, город с типом населённого пункта, почта входа, Яндекс ID, «с какого месяца» и уведомления', function () {
    $moscow = cityByName('Москва');
    $user = User::factory()->create([
        'name' => 'Анна',
        'email' => 'anna@example.test',
        'city_id' => $moscow->id,
        'yandex_id' => 'ya-1',
        'created_at' => '2026-03-15 10:00:00',
    ]);

    $this->actingAs($user)->get('/account/profile')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Account/Profile')
            ->where('profile.name', 'Анна')
            ->where('profile.email', 'anna@example.test')
            ->where('profile.city', ['id' => $moscow->id, 'name' => 'Москва', 'type' => 'г.'])
            ->where('profile.yandex_connected', true)
            ->where('profile.since', '2026-03')
            ->where('notifications', [['key' => 'new_message', 'enabled' => true]]));
});

it('профиль без города и без Яндекс ID', function () {
    $this->actingAs(User::factory()->create(['city_id' => null, 'yandex_id' => null]))->get('/account/profile')
        ->assertInertia(fn (Assert $page) => $page
            ->where('profile.city', null)
            ->where('profile.yandex_connected', false));
});

it('почта (BR-04): в общих props и в чужих ответах её нет, в профиле — только у владельца', function () {
    $me = User::factory()->create(['email' => 'me@example.test', 'yandex_id' => 'ya-secret']);
    $other = User::factory()->create(['email' => 'other@example.test']);

    $own = $this->actingAs($me)->get('/account/profile');
    $own->assertInertia(fn (Assert $page) => $page
        ->where('profile.email', 'me@example.test')
        ->missing('auth.user.email'));
    expect($own->getContent())->not->toContain('other@example.test')->not->toContain('ya-secret');

    $overview = $this->actingAs($other)->get('/account')->getContent();
    expect($overview)->not->toContain('me@example.test')->not->toContain('other@example.test');
});

it('меняет имя и город: сохраняется, шапка и город сайта берут новый', function () {
    $user = User::factory()->create(['name' => 'Анна', 'city_id' => cityByName('Москва')->id]);
    $spb = cityByName('Санкт-Петербург');

    $this->actingAs($user)->patch('/account/profile', ['name' => '  Анна Ким  ', 'city_id' => $spb->id])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect($user->fresh()->name)->toBe('Анна Ким')->and($user->fresh()->city_id)->toBe($spb->id);

    $this->actingAs($user->fresh())->get('/account/profile')->assertInertia(fn (Assert $page) => $page
        ->where('auth.user.name', 'Анна Ким')
        ->where('auth.user.city.name', 'Санкт-Петербург')
        ->where('city.name', 'Санкт-Петербург'));
});

it('город можно не указывать', function () {
    $user = User::factory()->create(['city_id' => cityByName('Москва')->id]);

    $this->actingAs($user)->patch('/account/profile', ['name' => 'Анна', 'city_id' => null])->assertSessionHasNoErrors();

    expect($user->fresh()->city_id)->toBeNull();
});

it('проверяет имя и город', function (array $payload, string $field) {
    $user = User::factory()->create(['name' => 'Анна']);

    $this->actingAs($user)->patch('/account/profile', $payload)->assertSessionHasErrors($field);

    expect($user->fresh()->name)->toBe('Анна');
})->with([
    'пустое имя' => [['name' => '   '], 'name'],
    'без имени' => [[], 'name'],
    'длинное имя' => [['name' => str_repeat('я', 256)], 'name'],
    'имя не строка' => [['name' => ['a']], 'name'],
    'города нет в справочнике' => [['name' => 'Анна', 'city_id' => 999999], 'city_id'],
    'город не число' => [['name' => 'Анна', 'city_id' => 'абв'], 'city_id'],
]);

it('почту, Яндекс ID и согласие через профиль не поменять', function () {
    $user = User::factory()->create(['email' => 'keep@example.test', 'yandex_id' => 'ya-keep']);

    $this->actingAs($user)->patch('/account/profile', [
        'name' => 'Анна', 'email' => 'new@example.test', 'yandex_id' => 'ya-new', 'consent_version' => 'x',
    ])->assertSessionHasNoErrors();

    $fresh = $user->fresh();
    expect($fresh->email)->toBe('keep@example.test')
        ->and($fresh->yandex_id)->toBe('ya-keep')
        ->and($fresh->consent_version)->toBe('factory');
});

it('сообщения об ошибках — по-русски, из lang/ru', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->patch('/account/profile', ['name' => ''])
        ->assertSessionHasErrors(['name' => 'Укажите имя']);
    $this->actingAs($user)->patch('/account/profile', ['name' => 'Анна', 'city_id' => 999999])
        ->assertSessionHasErrors(['city_id' => 'Выберите город из списка']);
});

it('уведомления: выключение сохраняется и отражается в профиле', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->put('/account/notifications', ['new_message' => false])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $this->actingAs($user->fresh())->get('/account/profile')->assertInertia(fn (Assert $page) => $page
        ->where('notifications', [['key' => 'new_message', 'enabled' => false]]));

    $this->actingAs($user->fresh())->put('/account/notifications', ['new_message' => true]);
    expect($user->fresh()->notification_prefs)->toBe(['new_message' => true]);
});

it('уведомления: значение обязательно и логическое, чужие ключи игнорируются', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->put('/account/notifications', [])->assertSessionHasErrors('new_message');
    $this->actingAs($user)->put('/account/notifications', ['new_message' => 'может'])->assertSessionHasErrors('new_message');

    $this->actingAs($user)->put('/account/notifications', ['new_message' => false, 'is_staff' => true, 'mystery' => false]);
    expect($user->fresh()->notification_prefs)->toBe(['new_message' => false]);
});

it('изменения — не чаще 30 раз в минуту', function () {
    $user = User::factory()->create();

    foreach (range(1, 30) as $_) {
        $this->actingAs($user)->patch('/account/profile', ['name' => 'Анна'])->assertRedirect();
    }
    $this->actingAs($user)->patch('/account/profile', ['name' => 'Анна'])->assertStatus(429);
});
