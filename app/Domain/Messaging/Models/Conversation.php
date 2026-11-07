<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Models;

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Models\Listing;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Беседа покупателя и продавца по объявлению (SPEC §7 CONVERSATION). Одна на пару объявление–покупатель.
 * Участник с null — удалил аккаунт (BR-09): переписка остаётся у собеседника.
 *
 * Участники задаются явно при создании (StartConversation), массовой записи нет.
 *
 * @property string $id
 * @property string $listing_id
 * @property int|null $buyer_id
 * @property int|null $seller_id
 * @property Carbon|null $last_message_at
 * @property Carbon|null $created_at
 * @property-read Listing $listing
 * @property-read User|null $buyer
 * @property-read User|null $seller
 */
class Conversation extends Model
{
    use HasUuids;

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'buyer_id' => 'integer',
            'seller_id' => 'integer',
            'last_message_at' => 'datetime',
        ];
    }

    public function isParticipant(?User $user): bool
    {
        return $user !== null && in_array($user->id, [$this->buyer_id, $this->seller_id], true);
    }

    public function isBuyer(User $user): bool
    {
        return $this->buyer_id !== null && $this->buyer_id === $user->id;
    }

    /** id второй стороны для участника $user; null — собеседник удалил аккаунт. */
    public function counterpartId(User $user): ?int
    {
        return $this->isBuyer($user) ? $this->seller_id : $this->buyer_id;
    }

    /** @return BelongsTo<Listing, $this> */
    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }

    /** @return BelongsTo<User, $this> */
    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    /** @return BelongsTo<User, $this> */
    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    /** @return HasMany<Message, $this> */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }
}
