<?php

declare(strict_types=1);

namespace App\Http\Resources\Catalog;

use App\Domain\Catalog\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use LogicException;

/** @mixin Category */
final class CategoryResource extends JsonResource
{
    /**
     * Явный список полей: служебные (is_visible, sort_order, parent_id, даты) наружу не уходят.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // Без загруженных потомков ответ был бы молчаливо пустым: лучше явная ошибка при неверной выборке.
        if (! $this->resource->relationLoaded('children')) {
            throw new LogicException('CategoryResource: потомки не загружены. Выбирайте дерево через CategoryTree.');
        }

        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'icon' => $this->icon,
            'children' => self::collection($this->children)->resolve($request),
        ];
    }
}
