<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Catalog\Queries\CategoryTree;
use App\Domain\Catalog\Queries\CurrentCity;
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
            'flags' => fn (): array => collect(FeatureFlag::cases())
                ->mapWithKeys(fn (FeatureFlag $flag): array => [
                    $flag->value => Feature::for(null)->active($flag->value),
                ])
                ->all(),
            // Справочник категорий для меню шапки: только видимые, явный список полей (CategoryResource).
            'categories' => fn (): array => CategoryResource::collection((new CategoryTree)->public())
                ->resolve($request),
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
