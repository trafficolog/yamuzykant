<?php

declare(strict_types=1);

namespace App\Domain\Moderation\Models;

use App\Domain\Listings\Models\Listing;
use App\Domain\Moderation\Enums\ModerationVerdict;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Решение модерации по объявлению. Причина — дословно, как увидит продавец (SPEC UC-O1).
 * Пишет только ListingStateMachine; запись не меняется (только created_at).
 *
 * @property int $id
 * @property string $listing_id
 * @property ModerationVerdict $verdict
 * @property string|null $reason
 * @property int|null $staff_id
 * @property Carbon $created_at
 */
class ModerationDecision extends Model
{
    public const UPDATED_AT = null;

    /** @var list<string> */
    protected $fillable = ['listing_id', 'verdict', 'reason', 'staff_id'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'verdict' => ModerationVerdict::class,
            'staff_id' => 'integer',
        ];
    }

    /** @return BelongsTo<Listing, $this> */
    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }
}
