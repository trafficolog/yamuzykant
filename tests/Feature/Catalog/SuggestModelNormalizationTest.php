<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Actions\SuggestInstrumentModel;
use App\Domain\Catalog\Enums\InstrumentModelStatus;
use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\InstrumentModel;
use Illuminate\Support\Facades\DB;

// Ревью 1.2.2: нормализация текста предложения, поиск без учёта регистра, гонка при вставке.

function guitarsForSuggestion(): Category
{
    return Category::factory()->create(['name' => 'Гитары', 'slug' => 'gitary-norm', 'is_visible' => true]);
}

it('пробелы по краям и внутри текста схлопываются', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/models/suggestions', ['text' => "  Ibanez \t RG9999    Custom ", 'category_id' => guitarsForSuggestion()->id])
        ->assertCreated()
        ->assertJsonPath('data.brand', 'Ibanez')
        ->assertJsonPath('data.name', 'RG9999 Custom');

    $this->assertDatabaseHas('instrument_models', ['brand' => 'Ibanez', 'name' => 'RG9999 Custom']);
});

it('повтор в другом регистре возвращает уже созданную модель и не дублирует', function () {
    $category = guitarsForSuggestion();
    $user = User::factory()->create();

    $first = $this->actingAs($user)
        ->postJson('/api/models/suggestions', ['text' => 'Ibanez RG9999 Custom', 'category_id' => $category->id])
        ->assertCreated()
        ->json('data.id');

    $second = $this->actingAs($user)
        ->postJson('/api/models/suggestions', ['text' => 'ibanez rg9999 CUSTOM', 'category_id' => $category->id])
        ->assertCreated()
        ->json('data.id');

    expect($second)->toBe($first)
        ->and(InstrumentModel::query()->where('brand', 'Ibanez')->count())->toBe(1);
});

it('существующая активная модель не меняет статус из-за предложения в другом регистре', function () {
    $category = guitarsForSuggestion();
    $active = InstrumentModel::factory()->for($category, 'category')->create([
        'brand' => 'Fender', 'name' => 'Stratocaster', 'status' => InstrumentModelStatus::Active,
    ]);

    app(SuggestInstrumentModel::class)('fender STRATOCASTER', $category->id);

    $this->assertDatabaseHas('instrument_models', ['id' => $active->id, 'status' => 'active']);
    expect(InstrumentModel::query()->where('brand', 'Fender')->count())->toBe(1);
});

it('гонка: запись появилась между проверкой и вставкой, возвращается существующая, а не 500', function () {
    $category = guitarsForSuggestion();
    $state = new ArrayObject(['armed' => true, 'fired' => false]);

    // Перед вставкой нашей модели параллельный запрос успевает вставить ту же (после нашей проверки).
    DB::beforeExecuting(function (string $sql) use ($state, $category): void {
        if ($state['armed'] !== true || $state['fired'] === true || ! str_starts_with(strtolower($sql), 'insert')) {
            return;
        }
        $state['fired'] = true;
        DB::table('instrument_models')->insert([
            'brand' => 'Ibanez',
            'name' => 'RG9999 Custom',
            'category_id' => $category->id,
            'status' => 'suggested',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    });

    try {
        $model = app(SuggestInstrumentModel::class)('Ibanez RG9999 Custom', $category->id);

        expect($state['fired'])->toBeTrue()
            ->and($model)->toBeInstanceOf(InstrumentModel::class)
            ->and($model->brand)->toBe('Ibanez')
            ->and(InstrumentModel::query()->where('brand', 'Ibanez')->count())->toBe(1);
    } finally {
        $state['armed'] = false;
    }
});
