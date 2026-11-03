<?php

declare(strict_types=1);

use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\City;
use App\Domain\Catalog\Models\InstrumentModel;
use App\Domain\Catalog\Queries\CategoryTree;
use Database\Seeders\CatalogSeeder;
use Tests\Support\MenuPrototype;

/**
 * Дерево из макета «Шапка»: вид → группа → пункты. «Мастера и ремонт» — раздел услуг, не вид инструмента.
 *
 * @return list<array{name: string, groups: list<array{title: string, items: list<string>}>}>
 */
function menuTreeFromPrototype(): array
{
    $html = (string) file_get_contents(base_path('design/prototypes/Шапка.dc.html'));
    $kinds = [];
    $kind = null;
    foreach ((array) preg_split('/\R/u', $html) as $line) {
        if (preg_match("/^  \{ name: '([^']+)', icon: '[^']+'/u", (string) $line, $m)) {
            if ($kind !== null) {
                $kinds[] = $kind;
            }
            $kind = ['name' => $m[1], 'groups' => []];
        } elseif ($kind !== null && preg_match("/\{ title: '([^']+)', items: \[(.*?)\]/u", (string) $line, $m)) {
            preg_match_all("/'([^']+)'/u", $m[2], $items);
            $kind['groups'][] = ['title' => $m[1], 'items' => $items[1]];
        }
    }
    if ($kind !== null) {
        $kinds[] = $kind;
    }

    return array_values(array_filter($kinds, fn (array $k) => $k['name'] !== 'Мастера и ремонт'));
}

beforeEach(function () {
    $this->seed(CatalogSeeder::class);
});

it('категории и порядок совпадают с меню категорий макета «Шапка»', function () {
    $expected = menuTreeFromPrototype();
    $tree = (new CategoryTree)->all();

    expect($expected)->toHaveCount(9);

    $actual = [];
    foreach ($tree as $kind) {
        $groups = [];
        foreach ($kind->children as $group) {
            $groups[] = ['title' => $group->name, 'items' => $group->children->pluck('name')->all()];
        }
        $actual[] = ['name' => $kind->name, 'groups' => $groups];
    }

    expect($actual)->toBe($expected);
});

it('8 видов инструментов видимы, раздел «Аксессуары и запчасти» скрыт (вне R1)', function () {
    $public = (new CategoryTree)->public();

    expect($public)->toHaveCount(8)
        ->and($public->pluck('name')->all())->not->toContain('Аксессуары и запчасти')
        ->and(Category::query()->where('name', 'Аксессуары и запчасти')->value('is_visible'))->toBeFalse();
});

it('у видов из меню есть иконки, slug не повторяются внутри родителя', function () {
    foreach (Category::query()->whereNull('parent_id')->get() as $kind) {
        expect($kind->icon)->not->toBeNull();
    }

    $dupes = Category::query()->selectRaw('parent_id, slug, count(*) as n')->groupBy('parent_id', 'slug')->havingRaw('count(*) > 1')->get();
    expect($dupes)->toHaveCount(0);
});

it('около 50 реальных моделей со статусом active', function () {
    $count = InstrumentModel::query()->count();

    expect($count)->toBeGreaterThanOrEqual(50)->toBeLessThanOrEqual(60)
        ->and(InstrumentModel::query()->where('status', '!=', 'active')->count())->toBe(0)
        ->and(InstrumentModel::query()->where('brand', 'Fender')->where('name', 'American Vintage ’57 Stratocaster')->exists())->toBeTrue()
        ->and(InstrumentModel::query()->where('brand', 'Boss')->where('name', 'DS-1 Distortion')->exists())->toBeTrue();
});

it('модели покрывают все 8 видимых видов', function () {
    $kindIds = (new CategoryTree)->public()->pluck('id')->all();
    $covered = [];
    foreach (InstrumentModel::query()->with('category.parent.parent')->get() as $model) {
        $node = $model->category ?? throw new LogicException("у модели {$model->id} нет категории");
        while ($node->parent instanceof Category) {
            $node = $node->parent;
        }
        $covered[$node->id] = true;
    }

    expect(array_diff($kindIds, array_keys($covered)))->toBe([]);
});

it('16 городов-миллионников с координатами в пределах России', function () {
    $cities = City::query()->ordered()->get();

    expect($cities)->toHaveCount(16)
        ->and($cities->pluck('name')->all())->toContain('Москва', 'Санкт-Петербург', 'Новосибирск', 'Казань', 'Волгоград');

    foreach ($cities as $city) {
        expect($city->lat)->toBeGreaterThan(41.0)->toBeLessThan(82.0)
            ->and($city->lng)->toBeGreaterThan(19.0)->toBeLessThan(180.0)
            ->and($city->region)->not->toBe('');
    }

    $moscow = $cities->sole('name', 'Москва');
    expect($moscow->lat)->toBe(55.7558)->and($moscow->lng)->toBe(37.6173);
});

it('повторный запуск сидов ничего не дублирует', function () {
    $before = [Category::query()->count(), InstrumentModel::query()->count(), City::query()->count()];

    $this->seed(CatalogSeeder::class);

    expect([Category::query()->count(), InstrumentModel::query()->count(), City::query()->count()])->toBe($before);
});

it('DatabaseSeeder запускает справочники', function () {
    $this->seed();

    expect(City::query()->count())->toBe(16);
});

it('годы выпуска: Gibson Les Paul Studio с 1983, Strymon Timeline с 2012', function () {
    expect(InstrumentModel::query()->where('brand', 'Gibson')->where('name', 'Les Paul Studio')->firstOrFail()->year_from)->toBe(1983)
        ->and(InstrumentModel::query()->where('brand', 'Strymon')->where('name', 'Timeline')->firstOrFail()->year_from)->toBe(2012);
});

it('разбор меню устойчив к отступам, переносам строк и кавычкам', function () {
    $html = (string) file_get_contents(base_path('design/prototypes/Шапка.dc.html'));
    // Тот же макет: двойные кавычки, другие отступы и перенос перед items.
    $variant = str_replace("'", '"', (string) preg_replace(['/^[ \t]+/m', '/,\s*items:/'], ['        ', ",\n      items:"], $html));

    expect(MenuPrototype::parse($variant))->toBe(MenuPrototype::parse($html))
        ->and(MenuPrototype::parse($html))->toHaveCount(9);
});
