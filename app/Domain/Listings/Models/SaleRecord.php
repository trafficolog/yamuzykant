<?php

declare(strict_types=1);

namespace App\Domain\Listings\Models;

use App\Domain\Listings\Enums\WithdrawReason;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Итог снятия с продажи (SPEC UC-L4). Итоговая цена публично не показывается.
 *
 * @property string $listing_id
 * @property WithdrawReason $reason
 * @property int|null $final_price
 * @property Carbon|null $sold_at
 */
class SaleRecord extends Model
{
    protected $primaryKey = 'listing_id';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = ['listing_id', 'reason', 'final_price', 'sold_at'];

    /** @var list<string> */
    protected $hidden = ['final_price'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'reason' => WithdrawReason::class,
            'final_price' => 'integer',
            'sold_at' => 'date',
        ];
    }

    /** @return BelongsTo<Listing, $this> */
    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }
}
