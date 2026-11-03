<?php

declare(strict_types=1);

namespace App\Http\Resources\Catalog;

use App\Domain\Catalog\Models\InstrumentModel;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin InstrumentModel */
final class InstrumentModelResource extends JsonResource
{
    /**
     * Явный список полей: статус и даты наружу не уходят.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'brand' => $this->brand,
            'name' => $this->name,
            'year_from' => $this->year_from,
            'year_to' => $this->year_to,
            'category_id' => $this->category_id,
        ];
    }
}
