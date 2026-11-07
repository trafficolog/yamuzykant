<?php

declare(strict_types=1);

use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\InstrumentModel;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

// Ревью 1.2.1 (п. 3–4): публичная выборка моделей — один запрос; shared prop categories кэшируется.

/**
 * SQL-запросы, выполненные во время замыкания.
 *
 * @return list<string>
 */
function sqlDuring(Closure $callback): array
{
    $sql = [];
    DB::listen(function (QueryExecuted $query) use (&$sql): void {
        $sql[] = $query->sql;
    });

    $callback();

    return $sql;
}

/** @param list<string> $sql */
function countTableQueries(array $sql, string $table): int
{
    return count(array_filter($sql, fn (string $statement): bool => str_contains($statement, '"'.$table.'"')
        || str_contains($statement, '`'.$table.'`')
        || str_contains($statement, ' '.$table.' ')));
}

it('публичный запрос моделей выполняется одним SQL-запросом', function () {
    $category = Category::factory()->create(['name' => 'Гитары', 'slug' => 'gitary-one-query']);
    InstrumentModel::factory()->for($category, 'category')->create(['brand' => 'Fender', 'name' => 'Player Stratocaster']);

    $sql = sqlDuring(fn () => InstrumentModel::query()->public()->get());

    expect($sql)->toHaveCount(1);
});

it('повторный Inertia-ответ не запрашивает таблицу категорий, пока она не менялась', function () {
    Category::factory()->create(['name' => 'Гитары', 'slug' => 'gitary-cache']);

    $this->get('/')->assertOk();
    $sql = sqlDuring(fn () => $this->get('/')->assertOk());

    expect(countTableQueries($sql, 'categories'))->toBe(0);
});

it('изменение категории сбрасывает кэш: следующий ответ показывает новое название', function () {
    $category = Category::factory()->create(['name' => 'Гитары', 'slug' => 'gitary-cache-bust']);

    $this->get('/')->assertInertia(fn (Assert $page) => $page->where('categories.0.name', 'Гитары'));

    $category->update(['name' => 'Гитарки']);

    $this->get('/')->assertInertia(fn (Assert $page) => $page->where('categories.0.name', 'Гитарки'));
});

it('удаление категории сбрасывает кэш', function () {
    $category = Category::factory()->create(['name' => 'Духовые', 'slug' => 'dukhovye-cache']);

    $this->get('/')->assertInertia(fn (Assert $page) => $page->has('categories', 1));

    $category->delete();

    $this->get('/')->assertInertia(fn (Assert $page) => $page->has('categories', 0));
});
