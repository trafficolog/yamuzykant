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
use App\Domain\Search\ListingDocument;
use Closure;
use Database\Factories\Listings\ListingFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;
use InvalidArgumentException;
use Laravel\Scout\Searchable;
use LogicException;

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
 * @property string|null $draft_price_mode Режим цены в форме черновика (amount|negotiable|free); у опубликованного null
 * @property bool $negotiable
 * @property bool $meet
 * @property bool $ship
 * @property int|null $city_id
 * @property Carbon|null $published_at
 * @property Carbon|null $unpublished_at
 * @property-read User $user
 * @property-read SaleRecord|null $saleRecord
 */
#[UseFactory(ListingFactory::class)]
class Listing extends Model
{
    /** @use HasFactory<ListingFactory> */
    use HasFactory;

    use HasUuids;
    use Searchable;

    /** Видимые символы маски серийного номера. */
    private const SERIAL_VISIBLE = 3;

    /** Скрытая часть маски: всегда 4 звезды, чтобы маска не выдавала длину номера. */
    private const SERIAL_HIDDEN = '****';

    /**
     * Поля содержания, которые меняет продавец (белый список правки). Владелец (user_id), статус,
     * даты и id сюда не входят: владелец задаётся явно при создании, статус — только машиной.
     *
     * @var list<string>
     */
    public const EDITABLE = [
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
     * Смена статуса разрешена только внутри withStatusChange() — её вызывает ListingStateMachine.
     * Флаг у экземпляра, а не статический: общего на процесс состояния нет, поэтому в Octane
     * (долгоживущий процесс, корутины) разрешение одного запроса не протекает в другой.
     */
    private bool $statusChangeAllowed = false;

    /** @var list<string> */
    protected $fillable = [
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
        'draft_price_mode',
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
            'unpublished_at' => 'datetime',
        ];
    }

    /**
     * `user_id` не в $fillable, и Eloquent молча отбросил бы его в update()/fill(). Для существующей
     * записи другой владелец в массовой записи — явная ошибка, а не тихий пропуск.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function fill(array $attributes): static
    {
        if ($this->exists && array_key_exists('user_id', $attributes)) {
            // Колонка не загружена (select подмножества): сравнивать не с чем, а чтение при
            // preventAccessingMissingAttributes дало бы MissingAttributeException вместо LogicException.
            if (! array_key_exists('user_id', $this->getAttributes()) || (int) $attributes['user_id'] !== $this->user_id) {
                throw new LogicException('Владельца объявления менять нельзя.');
            }
        }

        return parent::fill($attributes);
    }

    /**
     * Защита в глубину к arch-тесту: смена статуса существующего объявления вне машины — исключение;
     * цена не бывает отрицательной (деньги — целые рубли ≥ 0).
     */
    protected static function booted(): void
    {
        static::saving(function (Listing $listing): void {
            if ($listing->price !== null && $listing->price < 0) {
                throw new InvalidArgumentException('Цена не может быть отрицательной.');
            }

            if ($listing->exists && $listing->isDirty('status') && ! $listing->statusChangeAllowed) {
                throw new LogicException('Статус объявления меняет только ListingStateMachine.');
            }

            // Момент ухода из published ведёт только машина (от него считается срок ответов, BR-10).
            if ($listing->exists && $listing->isDirty('unpublished_at') && ! $listing->statusChangeAllowed) {
                throw new LogicException('Поле unpublished_at ведёт только ListingStateMachine.');
            }

            if ($listing->exists && $listing->isDirty('user_id')) {
                throw new LogicException('Владельца объявления менять нельзя.');
            }
        });
    }

    /**
     * Выполнить сохранение со сменой статуса этого экземпляра. Только для ListingStateMachine
     * (вызов вне app/Domain/Listings/StateMachines ловит StatusWriteScanner).
     *
     * Разрешение сбрасывается в finally, даже если колбэк бросил исключение.
     *
     * @internal
     *
     * @template T
     *
     * @param  Closure(): T  $callback
     * @return T
     */
    public function withStatusChange(Closure $callback): mixed
    {
        $previous = $this->statusChangeAllowed;
        $this->statusChangeAllowed = true;

        try {
            return $callback();
        } finally {
            $this->statusChangeAllowed = $previous;
        }
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

    /**
     * Документ индекса `listings` — явный список полей, без серийного номера, e-mail, user_id и итоговой цены.
     *
     * @return array<string, mixed>
     */
    public function toSearchableArray(): array
    {
        return ListingDocument::for($this);
    }

    /** В индексе только опубликованные. */
    public function shouldBeSearchable(): bool
    {
        return $this->status === ListingStatus::Published;
    }

    /**
     * Индекс обновляет job SyncListingToIndex по событиям машины статусов, а не сохранение модели:
     * иначе правка черновика ходила бы в Meilisearch, а статус менялся бы мимо очереди и сверки.
     */
    public function searchIndexShouldBeUpdated(): bool
    {
        return false;
    }

    /**
     * @param  Builder<Listing>  $query
     * @return Builder<Listing>
     */
    protected function makeAllSearchableUsing(Builder $query): Builder
    {
        return $query->with(ListingDocument::RELATIONS);
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
