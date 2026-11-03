<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Enums\InstrumentModelStatus;
use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\InstrumentModel;
use Tests\Support\MeilisearchIndex;

// Критерии 1.2.2: «стратокастер» → Fender Stratocaster; опечатка в одну букву; 8 результатов; ≤ 100 мс;
// предложенные модели не в выдаче; предложение без выбора создаёт модель suggested.

beforeEach(function () {
    MeilisearchIndex::reset();
});

function electricGuitarsCategory(): Category
{
    $guitars = Category::factory()->create(['name' => 'Гитары', 'slug' => 'gitary', 'is_visible' => true]);

    return Category::factory()->for($guitars, 'parent')->create([
        'name' => 'Электрогитары', 'slug' => 'elektrogitary', 'is_visible' => true,
    ]);
}

function stratocasterModel(Category $category): InstrumentModel
{
    return InstrumentModel::factory()->for($category, 'category')->create([
        'brand' => 'Fender',
        'name' => 'American Vintage ’57 Stratocaster',
        'status' => InstrumentModelStatus::Active,
    ]);
}

it('запрос «стратокастер» находит Fender Stratocaster (синоним)', function () {
    stratocasterModel(electricGuitarsCategory());
    MeilisearchIndex::waitForTasks();

    $this->getJson('/api/models?q='.rawurlencode('стратокастер'))
        ->assertOk()
        ->assertJsonPath('data.0.brand', 'Fender')
        ->assertJsonPath('data.0.name', 'American Vintage ’57 Stratocaster');
});

it('опечатка в одну букву находит модель', function () {
    stratocasterModel(electricGuitarsCategory());
    MeilisearchIndex::waitForTasks();

    $this->getJson('/api/models?q=Stratocastr')
        ->assertOk()
        ->assertJsonPath('data.0.name', 'American Vintage ’57 Stratocaster');
});

it('в выдаче не больше 8 моделей', function () {
    $category = electricGuitarsCategory();
    foreach (range(1, 10) as $number) {
        InstrumentModel::factory()->for($category, 'category')->create([
            'brand' => 'Fender', 'name' => "Stratocaster Серия {$number}",
        ]);
    }
    MeilisearchIndex::waitForTasks();

    $this->getJson('/api/models?q=stratocaster')
        ->assertOk()
        ->assertJsonCount(8, 'data');
});

it('каждая модель отдаётся с явным списком полей без статуса', function () {
    stratocasterModel(electricGuitarsCategory());
    MeilisearchIndex::waitForTasks();

    $row = $this->getJson('/api/models?q=stratocaster')->assertOk()->json('data.0');

    expect(array_keys($row))->toBe(['id', 'brand', 'name', 'year_from', 'year_to', 'category_id']);
});

it('предложенные и скрытые модели, а также модели скрытой категории не попадают в выдачу', function () {
    $category = electricGuitarsCategory();
    InstrumentModel::factory()->for($category, 'category')->suggested()->create(['brand' => 'Fender', 'name' => 'Stratocaster Предложенная']);
    InstrumentModel::factory()->for($category, 'category')->hiddenStatus()->create(['brand' => 'Fender', 'name' => 'Stratocaster Скрытая']);
    $hiddenCategory = Category::factory()->hidden()->create(['name' => 'Архив', 'slug' => 'arkhiv']);
    InstrumentModel::factory()->for($hiddenCategory, 'category')->create(['brand' => 'Fender', 'name' => 'Stratocaster Архивная']);
    stratocasterModel($category);
    MeilisearchIndex::waitForTasks();

    $this->getJson('/api/models?q=stratocaster')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'American Vintage ’57 Stratocaster');
});

it('смена статуса убирает модель из выдачи и возвращает обратно', function () {
    $model = stratocasterModel(electricGuitarsCategory());
    MeilisearchIndex::waitForTasks();

    $model->update(['status' => InstrumentModelStatus::Hidden]);
    MeilisearchIndex::waitForTasks();
    $this->getJson('/api/models?q=stratocaster')->assertJsonCount(0, 'data');

    $model->update(['status' => InstrumentModelStatus::Active]);
    MeilisearchIndex::waitForTasks();
    $this->getJson('/api/models?q=stratocaster')->assertJsonCount(1, 'data');
});

it('пустой или однобуквенный запрос возвращает пустой список', function () {
    stratocasterModel(electricGuitarsCategory());
    MeilisearchIndex::waitForTasks();

    $this->getJson('/api/models')->assertOk()->assertJsonCount(0, 'data');
    $this->getJson('/api/models?q=S')->assertOk()->assertJsonCount(0, 'data');
});

it('ответ на запрос подсказки укладывается в 100 мс', function () {
    stratocasterModel(electricGuitarsCategory());
    MeilisearchIndex::waitForTasks();
    $this->getJson('/api/models?q=stratocaster')->assertOk();

    $started = hrtime(true);
    $this->getJson('/api/models?q=stratocaster')->assertOk();
    $elapsedMs = (hrtime(true) - $started) / 1_000_000;

    expect($elapsedMs)->toBeLessThanOrEqual(100);
});

it('гость не может предложить модель', function () {
    $this->postJson('/api/models/suggestions', ['text' => 'Ibanez RG9999 Custom', 'category_id' => electricGuitarsCategory()->id])
        ->assertUnauthorized();
});

it('предложение без выбора создаёт модель со статусом suggested и не попадает в выдачу', function () {
    $category = electricGuitarsCategory();

    $this->actingAs(User::factory()->create())
        ->postJson('/api/models/suggestions', ['text' => 'Ibanez RG9999 Custom', 'category_id' => $category->id])
        ->assertCreated()
        ->assertJsonPath('data.brand', 'Ibanez')
        ->assertJsonPath('data.name', 'RG9999 Custom');

    $this->assertDatabaseHas('instrument_models', ['brand' => 'Ibanez', 'name' => 'RG9999 Custom', 'status' => 'suggested']);
    MeilisearchIndex::waitForTasks();
    $this->getJson('/api/models?q=RG9999')->assertJsonCount(0, 'data');
});

it('повторное предложение той же модели не создаёт дубль', function () {
    $category = electricGuitarsCategory();
    $user = User::factory()->create();

    $this->actingAs($user)->postJson('/api/models/suggestions', ['text' => 'Ibanez RG9999 Custom', 'category_id' => $category->id])->assertCreated();
    $this->actingAs($user)->postJson('/api/models/suggestions', ['text' => 'Ibanez RG9999 Custom', 'category_id' => $category->id])->assertCreated();

    expect(InstrumentModel::query()->where('brand', 'Ibanez')->count())->toBe(1);
});

it('предложение из одного слова отклоняется: нужны бренд и модель', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/models/suggestions', ['text' => 'Ibanez', 'category_id' => electricGuitarsCategory()->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('text');
});
