<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Models\City;
use Database\Seeders\CitySeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Response;

beforeEach(function () {
    $this->seed(CitySeeder::class);
});

function cityNamed(string $name): City
{
    return City::query()->where('name', $name)->firstOrFail();
}

/**
 * Cookie `ym_city` из ответа (значение уже зашифровано Laravel).
 *
 * @param  TestResponse<Response>  $response
 */
function cityCookieFrom(TestResponse $response): Cookie
{
    foreach ($response->headers->getCookies() as $cookie) {
        if ($cookie->getName() === 'ym_city') {
            return $cookie;
        }
    }

    throw new RuntimeException('Cookie ym_city не найдена в ответе');
}

/** Число запросов к таблице cities за блок. */
function citiesQueries(Closure $callback): int
{
    DB::flushQueryLog();
    DB::enableQueryLog();
    $callback();
    $count = collect(DB::getQueryLog())->filter(fn (array $log) => str_contains($log['query'], 'cities'))->count();
    DB::disableQueryLog();

    return $count;
}

it('без cookie город по умолчанию — Москва; в shared prop только id и name', function () {
    $moscow = cityNamed('Москва');

    $this->get('/')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('city', 2)
        ->where('city.id', $moscow->id)
        ->where('city.name', 'Москва'));
});

it('Москва по умолчанию находится по стабильному slug из конфига, а не по названию', function () {
    expect(config('city.default_slug'))->toBe('moscow');

    City::query()->where('slug', 'moscow')->update(['name' => 'Москва переименована']);

    $this->get('/')->assertInertia(fn (Assert $page) => $page->where('city.name', 'Москва переименована'));
});

it('выбор города: cookie на год, SameSite=Lax, HttpOnly, значение зашифровано', function () {
    $spb = cityNamed('Санкт-Петербург');

    $response = $this->post('/city', ['city_id' => $spb->id]);

    $response->assertRedirect();
    $cookie = cityCookieFrom($response);
    expect($cookie->getSameSite())->toBe('lax')
        ->and($cookie->isHttpOnly())->toBeTrue()
        ->and($cookie->getExpiresTime() - time())->toBeGreaterThan(364 * 86400)
        ->and($cookie->getExpiresTime() - time())->toBeLessThanOrEqual(366 * 86400)
        ->and($cookie->getValue())->not->toBe((string) $spb->id);
});

it('гостевой город сохраняется между визитами по cookie', function () {
    $spb = cityNamed('Санкт-Петербург');

    $this->withCookie('ym_city', (string) $spb->id)
        ->get('/')
        ->assertInertia(fn (Assert $page) => $page
            ->where('city.id', $spb->id)
            ->where('city.name', 'Санкт-Петербург'));
});

it('после выбора новый город сразу виден на следующей загрузке страницы', function () {
    $kazan = cityNamed('Казань');
    $encrypted = cityCookieFrom($this->post('/city', ['city_id' => $kazan->id]))->getValue()
        ?? throw new RuntimeException('Пустое значение cookie ym_city');

    $this->withUnencryptedCookie('ym_city', $encrypted)
        ->get('/')
        ->assertInertia(fn (Assert $page) => $page->where('city.name', 'Казань'));
});

it('подменённая cookie (не зашифрована Laravel) не даёт города — возврат к Москве', function () {
    $spb = cityNamed('Санкт-Петербург');

    $this->withUnencryptedCookie('ym_city', (string) $spb->id)
        ->get('/')
        ->assertInertia(fn (Assert $page) => $page->where('city.name', 'Москва'));
});

it('cookie с некорректным значением — возврат к Москве', function (string $value) {
    $this->withCookie('ym_city', $value)
        ->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('city.name', 'Москва'));
})->with([
    'мусор' => ['abc'],
    'пустая строка' => [''],
    'огромное число' => ['99999999999999999999999999'],
    'отрицательное число' => ['-1'],
    'удалённый город' => ['999999'],
]);

it('массив в cookie (ym_city[]) — возврат к Москве, без ошибки', function () {
    $this->withHeader('Cookie', 'ym_city[]=1')
        ->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('city.name', 'Москва'));
});

it('несуществующий город отклоняется, cookie не ставится', function () {
    $response = $this->post('/city', ['city_id' => 999999]);

    $response->assertSessionHasErrors('city_id');
    $names = collect($response->headers->getCookies())->map(fn (Cookie $cookie) => $cookie->getName());
    expect($names)->not->toContain('ym_city');
});

it('вошедший с несуществующим city_id получает 422, users.city_id не меняется', function () {
    $moscow = cityNamed('Москва');
    $user = User::factory()->create(['city_id' => $moscow->id]);

    $this->actingAs($user)
        ->postJson('/city', ['city_id' => 999999])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('city_id');

    expect(User::query()->find($user->id)?->city_id)->toBe($moscow->id);
});

it('city_id обязателен и должен быть целым числом', function () {
    $this->post('/city', [])->assertSessionHasErrors('city_id');
    $this->post('/city', ['city_id' => 'Москва'])->assertSessionHasErrors('city_id');
});

it('POST без CSRF-токена отклоняется с 419', function () {
    // В тестах Laravel пропускает проверку CSRF только при окружении testing.
    $this->app['env'] = 'local';
    $spb = cityNamed('Санкт-Петербург');

    $this->post('/city', ['city_id' => $spb->id])->assertStatus(419);
});

it('смена города ограничена 30 запросами в минуту', function () {
    $spb = cityNamed('Санкт-Петербург');

    for ($i = 0; $i < 30; $i++) {
        $this->post('/city', ['city_id' => $spb->id])->assertRedirect();
    }

    $this->post('/city', ['city_id' => $spb->id])->assertStatus(429);
});

it('вошедший: выбор пишется в users.city_id и читается раньше cookie', function () {
    $moscow = cityNamed('Москва');
    $spb = cityNamed('Санкт-Петербург');
    $kazan = cityNamed('Казань');
    $user = User::factory()->create(['city_id' => $moscow->id]);

    $this->actingAs($user)->post('/city', ['city_id' => $spb->id])->assertRedirect();

    expect(User::query()->find($user->id)?->city_id)->toBe($spb->id);

    $this->actingAs($user)
        ->withCookie('ym_city', (string) $kazan->id)
        ->get('/')
        ->assertInertia(fn (Assert $page) => $page->where('city.name', 'Санкт-Петербург'));
});

it('вошедший без выбора в users.city_id получает город из cookie', function () {
    $kazan = cityNamed('Казань');
    $user = User::factory()->create(['city_id' => null]);

    $this->actingAs($user)
        ->withCookie('ym_city', (string) $kazan->id)
        ->get('/')
        ->assertInertia(fn (Assert $page) => $page->where('city.name', 'Казань'));
});

it('на страницах город читается одним запросом к cities', function () {
    $spb = cityNamed('Санкт-Петербург');

    $count = citiesQueries(fn () => $this->withCookie('ym_city', (string) $spb->id)->get('/'));

    expect($count)->toBeLessThanOrEqual(1);
});

it('выбор города: не больше одного запроса к cities (проверка существования и запись вместе)', function () {
    $spb = cityNamed('Санкт-Петербург');

    $count = citiesQueries(fn () => $this->post('/city', ['city_id' => $spb->id]));

    expect($count)->toBeLessThanOrEqual(1);
});

it('справочник отдаёт тип населённого пункта: перед названием «г.» в профиле (1.1.3)', function () {
    $this->getJson('/cities?q=казан')
        ->assertOk()
        ->assertJsonPath('data.0.name', 'Казань')
        ->assertJsonPath('data.0.type', 'г.');
});

it('поиск по справочнику: без запроса все города по алфавиту, с запросом — подстрока без учёта регистра', function () {
    $this->getJson('/cities')
        ->assertOk()
        ->assertJsonCount(16, 'data')
        ->assertJsonPath('data.0.name', 'Волгоград')
        ->assertJsonStructure(['data' => [['id', 'name', 'region']]]);

    $this->getJson('/cities?q=петер')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Санкт-Петербург');

    $this->getJson('/cities?q=ЗЗЗ')->assertOk()->assertJsonCount(0, 'data');
});

it('поиск отдаёт только явные поля (без координат и дат)', function () {
    $item = $this->getJson('/cities?q=Москва')->json('data.0');

    expect(array_keys($item))->toBe(['id', 'name', 'region']);
});

it('поиск: строка запроса длиннее 100 символов отклоняется с 422', function () {
    $this->getJson('/cities?q='.str_repeat('а', 101))->assertStatus(422)->assertJsonValidationErrors('q');
});

it('поиск ограничен 60 запросами в минуту', function () {
    for ($i = 0; $i < 60; $i++) {
        $this->getJson('/cities')->assertOk();
    }

    $this->getJson('/cities')->assertStatus(429);
});
