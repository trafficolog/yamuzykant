<?php

declare(strict_types=1);

namespace App\Domain\Listings\Models;

use App\Domain\Accounts\Models\User;
use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\City;
use App\Domain\Catalog\Models\InstrumentModel;
use App\Domain\Listings\Enums\Condition;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Moderation\Models\ModerationDecision;
use Database\Factories\Listings\ListingFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * Объявление (SPEC §7 LISTING). Статус — только через ListingStateMachine: его нет в $fillable,
 * прямую запись ловит arch-тест. Серийный номер зашифрован и не сериализуется; наружу — serialMasked().
 *
 * @property string $id
 * @property int $user_id
 * @property ListingStatus $status
 * @property int|null $category_id
 * @property int|null $model_id
 * @property string|null $title
 * @property int|null $year
 * @property string|null $serial_enc
 * @property Condition|null $condition
 * @property string|null $description
 * @property int|null $price
 * @property bool $negotiable
 * @property bool $meet
 * @property bool $ship
 * @property int|null $city_id
 * @property Carbon|null $published_at
 * @property-read User $user
 * @property-read SaleRecord|null $saleRecord
 */
#[UseFactory(ListingFactory::class)]
class Listing extends Model
{
    /** @use HasFactory<ListingFactory> */
    use HasFactory;

    use HasUuids;

    /** Видимые символы маски серийного номера. */
    private const SERIAL_VISIBLE = 3;

    /** Скрытая часть маски: всегда 4 звезды, чтобы маска не выдавала длину номера. */
    private const SERIAL_HIDDEN = '****';

    /** @var list<string> */
    protected $fillable = [
        'user_id',
        'category_id',
        'model_id',
        'title',
        'year',
        'serial_enc',
        'condition',
        'description',
        'price',
        'negotiable',
        'meet',
        'ship',
        'city_id',
    ];

    /**
     * Полный серийный номер не уходит на фронт (AGENTS.md §4).
     *
     * @var list<string>
     */
    protected $hidden = ['serial_enc'];

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => 'draft',
        'negotiable' => false,
        'meet' => true,
        'ship' => false,
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => ListingStatus::class,
            'condition' => Condition::class,
            'serial_enc' => 'encrypted',
            'user_id' => 'integer',
            'category_id' => 'integer',
            'model_id' => 'integer',
            'city_id' => 'integer',
            'year' => 'integer',
            'price' => 'integer',
            'negotiable' => 'boolean',
            'meet' => 'boolean',
            'ship' => 'boolean',
            'published_at' => 'datetime',
        ];
    }

    /**
     * Маска для публичных данных и индекса: `V091234` → `V09****`.
     * Видно не больше 3 символов и всегда скрыто не меньше 4.
     */
    public function serialMasked(): ?string
    {
        $serial = trim((string) $this->serial_enc);
        if ($serial === '') {
            return null;
        }

        $visible = max(0, min(self::SERIAL_VISIBLE, mb_strlen($serial) - mb_strlen(self::SERIAL_HIDDEN)));

        return mb_substr($serial, 0, $visible).self::SERIAL_HIDDEN;
    }

    /** Когда опубликованное объявление уйдёт в expired (config listings.expire_after_days). */
    public function expiresAt(): ?Carbon
    {
        return $this->published_at?->copy()->addDays((int) config('listings.expire_after_days'));
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Category, $this> */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /** @return BelongsTo<InstrumentModel, $this> */
    public function model(): BelongsTo
    {
        return $this->belongsTo(InstrumentModel::class, 'model_id');
    }

    /** @return BelongsTo<City, $this> */
    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    /** @return HasMany<ListingPhoto, $this> */
    public function photos(): HasMany
    {
        return $this->hasMany(ListingPhoto::class)->orderBy('position');
    }

    /** @return HasOne<SaleRecord, $this> */
    public function saleRecord(): HasOne
    {
        return $this->hasOne(SaleRecord::class);
    }

    /** @return HasMany<ModerationDecision, $this> */
    public function moderationDecisions(): HasMany
    {
        return $this->hasMany(ModerationDecision::class);
    }
}
