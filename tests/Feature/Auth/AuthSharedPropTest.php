<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Accounts\Staff\StaffDirectory;
use App\Domain\Catalog\Models\City;
use Illuminate\Support\Facades\Auth;
use Inertia\Testing\AssertableInertia as Assert;

// 1.1.6: shared prop `auth.user` для шапки вошедшего. Только id, имя, город, признак сотрудника (BR-04).

const AUTH_EMAIL = 'anna.private@example.com';
const AUTH_YANDEX_ID = '1130000000000777';

function signedInUser(?City $city = null): User
{
    $user = User::factory()->create([
        'name' => 'Анна',
        'email' => AUTH_EMAIL,
        'yandex_id' => AUTH_YANDEX_ID,
        'city_id' => $city?->id,
    ]);
    Auth::guard('web')->login($user);

    return $user;
}

it('гость: auth.user пуст', function () {
    $this->get('/')->assertInertia(fn (Assert $page) => $page->where('auth.user', null));
});

it('вошедший: auth.user — id, имя, город и признак сотрудника, ничего больше', function () {
    $city = City::factory()->create(['name' => 'Казань']);
    $user = signedInUser($city);

    $this->get('/')->assertInertia(fn (Assert $page) => $page
        ->where('auth.user', [
            'id' => $user->id,
            'name' => 'Анна',
            'city' => ['id' => $city->id, 'name' => 'Казань'],
            'is_staff' => false,
        ]));
});

it('вошедший без города: city в auth.user пуст', function () {
    signedInUser();

    $this->get('/')->assertInertia(fn (Assert $page) => $page->where('auth.user.city', null));
});

it('сотрудник: is_staff берётся из StaffDirectory', function () {
    signedInUser();
    app()->bind(StaffDirectory::class, fn () => new class implements StaffDirectory
    {
        public function isStaff(User $user): bool
        {
            return true;
        }
    });

    $this->get('/')->assertInertia(fn (Assert $page) => $page->where('auth.user.is_staff', true));
});

it('в HTML страницы нет почты и yandex_id пользователя', function () {
    signedInUser();

    $html = $this->get('/')->assertOk()->getContent();

    expect($html)->not->toContain(AUTH_EMAIL)
        ->not->toContain(AUTH_YANDEX_ID)
        ->not->toContain('yandex_id');
});

it('в JSON-ответе Inertia нет почты и yandex_id пользователя', function () {
    signedInUser();

    $version = $this->get('/')->viewData('page')['version'] ?? null;
    $json = $this->get('/', ['X-Inertia' => 'true', 'X-Inertia-Version' => (string) $version])
        ->assertOk()
        ->getContent();

    expect($json)->toContain('"auth"')
        ->not->toContain(AUTH_EMAIL)
        ->not->toContain(AUTH_YANDEX_ID)
        ->not->toContain('yandex_id');
});
