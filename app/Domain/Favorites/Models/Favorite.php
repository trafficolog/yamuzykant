<?php

declare(strict_types=1);

namespace App\Domain\Favorites\Models;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Models\Listing;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Объявление в избранном пользователя (SPEC §7 FAVORITE, UC-S5). Пара «пользователь — объявление» уникальна.
 * `price_at_save` — цена объявления на момент добавления (`null` — «Договорная», `0` — «Бесплатно», BR-11).
 *
 * @property int $id
 * @property int $user_id
 * @property string $listing_id
 * @property int|null $price_at_save
 * @property Carbon|null $created_at
 * @property-read User $user
 * @property-read Listing $listing
 */
class Favorite extends Model
{
    public const UPDATED_AT = null;

    /** @var list<string> */
    protected $fillable = ['user_id', 'listing_id', 'price_at_save'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'price_at_save' => 'integer',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Listing, $this> */
    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }
}
