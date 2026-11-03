<?php

declare(strict_types=1);

use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\InstrumentModel;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Log;
use Laravel\Scout\EngineManager;
use Tests\Support\MeilisearchIndex;

// Ревью 1.2.2: лимит на GET /api/models, длина q, недоступный Meilisearch, дневной лимит предложений,
// предложение только в видимую категорию.

beforeEach(function () {
    MeilisearchIndex::reset();
});

function visibleGuitarCategory(): Category
{
    return Category::factory()->create(['name' => 'Гитары', 'slug' => 'gitary-limits', 'is_visible' => true]);
}

it('маршрут подсказки имеет явный лимит throttle:60,1', function () {
    $route = app('router')->getRoutes()->getByName('api.models.search');

    expect($route->gatherMiddleware())->toContain('throttle:60,1');
});

it('больше 60 запросов подсказки в минуту с одного IP отвечают 429', function () {
    foreach (range(1, 60) as $_) {
        $this->getJson('/api/models?q=stratocaster')->assertOk();
    }

    $this->getJson('/api/models?q=stratocaster')->assertStatus(429);
});

it('q длиннее 100 символов отклоняется с 422', function () {
    $this->getJson('/api/models?q='.str_repeat('a', 101))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('q');
});

it('при недоступном Meilisearch подсказка отвечает пустым списком и пишет в лог, а не 500', function () {
    Log::spy();
    $host = config('scout.meilisearch.host');
    config(['scout.meilisearch.host' => 'http://127.0.0.1:9']);
    app(EngineManager::class)->forgetDrivers();

    try {
        $this->getJson('/api/models?q=stratocaster')
            ->assertOk()
            ->assertJsonCount(0, 'data');
        Log::shouldHaveReceived('warning');
    } finally {
        config(['scout.meilisearch.host' => $host]);
        app(EngineManager::class)->forgetDrivers();
    }
});

it('дневной лимит предложений на пользователя: 21-е предложение за сутки отвечает 429', function () {
    $category = visibleGuitarCategory();
    $user = User::factory()->create();
    // Минутный лимит маршрута здесь не тестируется: проверяется дневной.
    $this->withoutMiddleware(ThrottleRequests::class);

    foreach (range(1, 20) as $number) {
        $this->actingAs($user)
            ->postJson('/api/models/suggestions', ['text' => "Ibanez RG{$number} Custom", 'category_id' => $category->id])
            ->assertCreated();
    }

    $this->actingAs($user)
        ->postJson('/api/models/suggestions', ['text' => 'Ibanez RG99 Custom', 'category_id' => $category->id])
        ->assertStatus(429);
});

it('предложение в скрытую категорию отклоняется с 422', function () {
    $hidden = Category::factory()->hidden()->create(['name' => 'Архив', 'slug' => 'arkhiv-limits']);

    $this->actingAs(User::factory()->create())
        ->postJson('/api/models/suggestions', ['text' => 'Ibanez RG9999 Custom', 'category_id' => $hidden->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('category_id');

    expect(InstrumentModel::query()->count())->toBe(0);
});
