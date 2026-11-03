<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Models;

use App\Domain\Catalog\Enums\InstrumentModelStatus;
use App\Domain\Catalog\Queries\CategoryTree;
use Database\Factories\Catalog\InstrumentModelFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Laravel\Scout\Searchable;

/**
 * Модель инструмента из справочника.
 *
 * @property int $id
 * @property string $brand
 * @property string $name
 * @property int|null $year_from
 * @property int|null $year_to
 * @property int $category_id
 * @property InstrumentModelStatus $status
 */
#[UseFactory(InstrumentModelFactory::class)]
class InstrumentModel extends Model
{
    /** @use HasFactory<InstrumentModelFactory> */
    use HasFactory;

    use Searchable;

    /** @var list<string> */
    protected $fillable = ['brand', 'name', 'year_from', 'year_to', 'category_id', 'status'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'year_from' => 'integer',
            'year_to' => 'integer',
            'status' => InstrumentModelStatus::class,
        ];
    }

    /** @return BelongsTo<Category, $this> */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * Публично видимые модели: активные и в категории, которая не скрыта (сама и вся цепочка предков).
     *
     * @param  Builder<InstrumentModel>  $query
     */
    public function scopePublic(Builder $query): void
    {
        $query->where('status', InstrumentModelStatus::Active)
            ->whereIn('category_id', (new CategoryTree)->visibleIds())
            ->orderBy('brand')
            ->orderBy('name');
    }

    public function fullName(): string
    {
        return $this->brand.' '.$this->name;
    }

    /** Индекс подсказки; имя совпадает с таблицей и ключом в config/scout.php. */
    public function searchableAs(): string
    {
        return 'instrument_models';
    }

    /** @return array<string, mixed> */
    public function toSearchableArray(): array
    {
        return [
            'id' => $this->id,
            'brand' => $this->brand,
            'name' => $this->name,
        ];
    }

    /** В индексе только публичные модели: активные и в видимой категории (с предками). */
    public function shouldBeSearchable(): bool
    {
        return $this->status === InstrumentModelStatus::Active
            && in_array($this->category_id, (new CategoryTree)->visibleIds(), true);
    }

    /** Любое сохранение (статус, категория, название) сверяет документ в индексе. */
    public function searchIndexShouldBeUpdated(): bool
    {
        return true;
    }
}
