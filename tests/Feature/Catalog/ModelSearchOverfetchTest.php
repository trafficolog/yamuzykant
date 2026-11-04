<?php

declare(strict_types=1);

use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\InstrumentModel;
use Illuminate\Support\Facades\DB;
use Tests\Support\MeilisearchIndex;

// Ревью PR #92: подсказка берёт из индекса запас ×3 (устаревшие документы не съедают слоты) и отдаёт не больше 8.

beforeEach(function () {
    MeilisearchIndex::reset();
});

it('устаревшие документы индекса не уменьшают подсказку ниже 8 публичных моделей', function () {
    $category = Category::factory()->create(['name' => 'Гитары', 'slug' => 'overfetch-gitary', 'is_visible' => true]);

    // 16 моделей индексируются первыми (меньший id), затем становятся скрытыми в БД мимо наблюдателя:
    // индекс ещё держит их документы, а публичная выдача — нет.
    $stale = [];
    foreach (range(1, 16) as $number) {
        $stale[] = InstrumentModel::factory()->for($category, 'category')
            ->create(['brand' => 'Gibson', 'name' => "Les Paul Stale {$number}"])->id;
    }
    foreach (range(1, 8) as $number) {
        InstrumentModel::factory()->for($category, 'category')
            ->create(['brand' => 'Gibson', 'name' => "Les Paul Live {$number}"]);
    }
    MeilisearchIndex::waitForTasks();

    DB::table('instrument_models')->whereIn('id', $stale)->update(['status' => 'hidden']);

    $response = $this->getJson('/api/models?q=Les Paul');

    $response->assertOk()->assertJsonCount(8, 'data');
    foreach (range(1, 16) as $number) {
        $response->assertJsonMissing(['name' => "Les Paul Stale {$number}"]);
    }
});
