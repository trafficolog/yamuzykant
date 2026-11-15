<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Queries\CategoryTree;
use App\Domain\Catalog\Queries\CurrentCity;
use App\Domain\Listings\Enums\Condition;
use App\Domain\Search\FleaFilters;
use App\Domain\Search\FleaSort;
use App\Domain\Search\ListingSearch;
use App\Domain\Search\ListingSearchResult;
use App\Http\Resources\Listings\FleaListingResource;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/**
 * Выдача Барахолки (UC-S2, UC-S3): `/baraholka` и `/baraholka/{категория}`. Город — из шапки (BR-01),
 * фильтры — в адресе. Наружу уходят только карточки из FleaListingResource.
 */
final class FleaController extends Controller
{
    public function __invoke(Request $request, ?string $path = null): Response|RedirectResponse
    {
        [$category, $crumbs] = $path === null ? [null, []] : $this->category($path);
        $filters = FleaFilters::fromQuery($request->query());
        $city = (new CurrentCity)->for($request);

        $emptyResult = new ListingSearchResult([], [], 0, $filters->page, FleaFilters::PER_PAGE, ['condition' => [], 'category_path' => []], 0);
        $searchError = false;

        try {
            $result = $city === null
                ? $emptyResult
                : $this->search(ListingSearch::inCity($city), $category, $filters)->get($filters->page, FleaFilters::PER_PAGE);

            // Счётчики чипов состояния не зависят от выбранного состояния: иначе у остальных ступеней был бы нуль.
            $conditionCounts = $filters->conditions === [] || $city === null
                ? $result->facets['condition']
                : $this->search(ListingSearch::inCity($city), $category, $filters->withoutConditions())
                    ->get(1, 1)->facets['condition'];
        } catch (Throwable $exception) {
            // Поиск не ответил: страница открывается с пустой выдачей, фронт показывает Alert с повтором.
            Log::warning('Выдача Барахолки недоступна: поиск не ответил.', ['error' => $exception->getMessage()]);
            $searchError = true;
            $result = $emptyResult;
            $conditionCounts = [];
        }

        // Страница за последней при непустой выдаче: на последнюю, фильтры сохраняются.
        $pages = (int) ceil($result->total / $result->perPage);
        if ($result->total > 0 && $filters->page > $pages) {
            $query = http_build_query($filters->withPage($pages)->toQuery());

            return redirect($request->url().($query === '' ? '' : '?'.$query));
        }

        return Inertia::render('Flea/Index', [
            // «Показать ещё» — частичный запрос: карточки дописываются к уже загруженным.
            'listings' => Inertia::merge(fn (): array => FleaListingResource::cards($result->hits, $city->name ?? '', $request))
                ->matchOn('id'),
            'pagination' => [
                'page' => $result->page,
                'pages' => $pages,
                'total' => $result->total,
                'perPage' => $result->perPage,
            ],
            'filters' => [
                'q' => $filters->query,
                'condition' => array_map(fn (Condition $condition): string => $condition->value, $filters->conditions),
                'priceFrom' => $filters->priceFrom,
                'priceTo' => $filters->priceTo,
                'negotiable' => $filters->negotiable,
                'ship' => $filters->ship,
                'sort' => $filters->sort?->value,
            ],
            'sorts' => array_map(fn (FleaSort $sort): string => $sort->value, FleaSort::cases()),
            'conditions' => array_map(fn (Condition $condition): array => [
                'value' => $condition->value,
                'label' => $condition->label(),
                'count' => $conditionCounts[$condition->value] ?? 0,
            ], Condition::cases()),
            'category' => $category === null ? null : [
                'name' => $category->name,
                'path' => (string) $path,
                'crumbs' => $crumbs,
            ],
            'categoryCounts' => (object) $result->facets['category_path'],
            'searchError' => $searchError,
        ]);
    }

    private function search(ListingSearch $search, ?Category $category, FleaFilters $filters): ListingSearch
    {
        if ($category !== null) {
            $search = $search->inCategory($category);
        }

        return $filters->apply($search);
    }

    /**
     * Категория по пути из слагов: только публично видимая ветка, иначе 404.
     *
     * @return array{0: Category, 1: list<array{name: string, path: string}>}
     */
    private function category(string $path): array
    {
        /** @var Collection<int, Category> $level */
        $level = (new CategoryTree)->public();
        $found = null;
        $crumbs = [];
        $trail = '';

        foreach (explode('/', $path) as $slug) {
            $found = $level->first(fn (Category $node): bool => $node->slug === $slug);
            if ($found === null) {
                abort(404);
            }
            $trail = $trail === '' ? $slug : $trail.'/'.$slug;
            $crumbs[] = ['name' => $found->name, 'path' => $trail];
            /** @var Collection<int, Category> $level */
            $level = $found->children;
        }

        return [$found, $crumbs];
    }
}
