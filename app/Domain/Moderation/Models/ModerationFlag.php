<?php

declare(strict_types=1);

namespace App\Domain\Moderation\Models;

use App\Domain\Listings\Models\Listing;
use App\Domain\Moderation\Enums\RiskLevel;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Итог автопроверок объявления: риск и сигналы с пояснениями (UC-O1). Пишет только job AssessListingRisk.
 *
 * @property string $listing_id
 * @property RiskLevel $risk
 * @property list<array{code: string, field: string|null, message: string, details: array<string, mixed>}> $signals
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class ModerationFlag extends Model
{
    protected $primaryKey = 'listing_id';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = ['listing_id', 'risk', 'signals'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'risk' => RiskLevel::class,
            'signals' => 'array',
        ];
    }

    /** @return BelongsTo<Listing, $this> */
    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }
}
