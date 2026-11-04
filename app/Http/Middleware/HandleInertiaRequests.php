<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Catalog\Queries\CategoryTree;
use App\Domain\Catalog\Queries\CurrentCity;
use App\Domain\Catalog\Queries\PublicCategoriesCache;
use App\Http\Resources\Catalog\CategoryResource;
use App\Support\Flags\FeatureFlag;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Laravel\Pennant\Feature;

final class HandleInertiaRequests extends Middleware
{
    /** @var string */
    protected $rootView = 'app';

    /**
     * Общие props для всех страниц. Только явный список полей.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            // Флаги глобальные: scope null, а не текущий пользователь (for(null), а не default-scope).
            // Один запрос к таблице features на все флаги: values() загружает их пачкой.
            'flags' => fn (): array => array_map(
                fn (mixed $active): bool => (bool) $active,
                Feature::for(null)->values(array_map(
                    fn (FeatureFlag $flag): string => $flag->value,
                    FeatureFlag::cases(),
                )),
            ),
            // Справочник категорий для меню шапки: только видимые, явный список полей (CategoryResource).
            // Кэш сбрасывает наблюдатель категорий: повторный ответ не трогает таблицу, пока дерево не менялось.
            'categories' => fn (): array => PublicCategoriesCache::remember(
                fn (): array => CategoryResource::collection((new CategoryTree)->public())->resolve($request),
            ),
            // Город шапки (BR-01): только id и name; без cookie — Москва.
            'city' => fn (): ?array => $this->currentCity($request),
        ];
    }

    /** @return array{id: int, name: string}|null */
    private function currentCity(Request $request): ?array
    {
        $city = (new CurrentCity)->for($request);

        return $city === null ? null : ['id' => $city->id, 'name' => $city->name];
    }
}
