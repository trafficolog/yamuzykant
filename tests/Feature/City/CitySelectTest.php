<?php

declare(strict_types=1);

use App\Domain\Catalog\Models\City;
use Database\Seeders\CitySeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Symfony\Component\HttpFoundation\Cookie;

beforeEach(function () {
    $this->seed(CitySeeder::class);
});

function cityNamed(string $name): City
{
    return City::query()->where('name', $name)->firstOrFail();
}

/** Cookie `ym_city` из ответа (значение уже зашифровано Laravel). */
function cityCookieFrom($response): ?Cookie
{
    return collect($response->headers->getCookies())->first(fn (Cookie $cookie) => $cookie->getName() === 'ym_city');
}

it('без cookie город по умолчанию — Москва; в shared prop только id и name', function () {
    $moscow = cityNamed('Москва');

    $this->get('/')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('city', 2)
        ->where('city.id', $moscow->id)
        ->where('city.name', 'Москва'));
});

it('выбор города: cookie на год, SameSite=Lax, редирект назад', function () {
    $spb = cityNamed('Санкт-Петербург');

    $response = $this->post('/city', ['city_id' => $spb->id]);

    $response->assertRedirect();
    $cookie = cityCookieFrom($response);
    expect($cookie)->not->toBeNull()
        ->and($cookie->getSameSite())->toBe('lax')
        ->and($cookie->getExpiresTime() - time())->toBeGreaterThan(364 * 86400)
        ->and($cookie->getExpiresTime() - time())->toBeLessThanOrEqual(366 * 86400);
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
    $cookie = cityCookieFrom($this->post('/city', ['city_id' => $kazan->id]));

    $this->withCookie('ym_city', $cookie->getValue())
        ->get('/')
        ->assertInertia(fn (Assert $page) => $page->where('city.name', 'Казань'));
});

it('cookie с удалённым городом — возврат к Москве', function () {
    $this->withCookie('ym_city', '999999')
        ->get('/')
        ->assertInertia(fn (Assert $page) => $page->where('city.name', 'Москва'));
});

it('несуществующий город отклоняется, cookie не ставится', function () {
    $response = $this->post('/city', ['city_id' => 999999]);

    $response->assertSessionHasErrors('city_id');
    expect(cityCookieFrom($response))->toBeNull();
});

it('city_id обязателен и должен быть целым числом', function () {
    $this->post('/city', [])->assertSessionHasErrors('city_id');
    $this->post('/city', ['city_id' => 'Москва'])->assertSessionHasErrors('city_id');
});

it('смена города без CSRF-токена отклоняется', function () {
    $spb = cityNamed('Санкт-Петербург');

    $this->withMiddleware()
        ->post('/city', ['city_id' => $spb->id])
        ->assertStatus(419);
});

it('смена города ограничена 30 запросами в минуту', function () {
    $spb = cityNamed('Санкт-Петербург');

    for ($i = 0; $i < 30; $i++) {
        $this->post('/city', ['city_id' => $spb->id])->assertRedirect();
    }

    $this->post('/city', ['city_id' => $spb->id])->assertStatus(429);
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
