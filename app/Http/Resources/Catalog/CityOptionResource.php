<?php

declare(strict_types=1);

namespace App\Http\Resources\Catalog;

use App\Domain\Catalog\Models\City;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Город для списка выбора: только id, название, регион и тип населённого пункта (без координат и дат).
 *
 * @mixin City
 */
final class CityOptionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'region' => $this->region,
            // «г.», «пос.», «д.»: в тексте перед названием, без склонения (решение OWNER 08.11.2026).
            'type' => $this->settlement_type,
        ];
    }
}
