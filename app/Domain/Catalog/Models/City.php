<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Models;

use Database\Factories\Catalog\CityFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Город из справочника (города-миллионники, координаты нужны для расстояния — BR-01).
 *
 * @property int $id
 * @property string $name
 * @property string $region
 * @property float $lat
 * @property float $lng
 * @property string $settlement_type Краткий тип населённого пункта: «г.», «пос.», «д.»
 */
#[UseFactory(CityFactory::class)]
class City extends Model
{
    /** @use HasFactory<CityFactory> */
    use HasFactory;

    /** @var list<string> */
    protected $fillable = ['name', 'slug', 'region', 'lat', 'lng', 'settlement_type'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'lat' => 'float',
            'lng' => 'float',
        ];
    }

    /** @param  Builder<City>  $query */
    public function scopeOrdered(Builder $query): void
    {
        $query->orderBy('name');
    }
}
