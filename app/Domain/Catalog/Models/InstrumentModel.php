<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Models;

use App\Domain\Catalog\Enums\InstrumentModelStatus;
use App\Domain\Catalog\Queries\CategoryTree;
use App\Domain\Catalog\Search\ModelAliases;
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
        // Видимость цепочки предков считается рекурсивным CTE внутри того же запроса: один SQL, без visibleIds().
        $query->where('status', InstrumentModelStatus::Active)
            ->whereRaw('category_id IN ('.self::VISIBLE_CATEGORIES_SQL.')', [true, true])
            ->orderBy('brand')
            ->orderBy('name');
    }

    /**
     * Видимые категории: корень видим, и каждый потомок видим, пока видим его родитель.
     * Двойной bind — для is_visible в якорной и рекурсивной части.
     */
    private const VISIBLE_CATEGORIES_SQL = 'WITH RECURSIVE visible(id) AS ('
        .'SELECT id FROM categories WHERE parent_id IS NULL AND is_visible = ? '
        .'UNION ALL '
        .'SELECT c.id FROM categories c JOIN visible v ON c.parent_id = v.id WHERE c.is_visible = ?'
        .') SELECT id FROM visible';

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
            'aliases' => ModelAliases::for($this->brand, $this->name),
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
