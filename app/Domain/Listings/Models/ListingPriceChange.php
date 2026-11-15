<?php

declare(strict_types=1);

namespace App\Domain\Listings\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Запись истории цены опубликованного объявления (2.1.5). Пишет только ListingStateMachine::edit().
 *
 * @property int $id
 * @property string $listing_id
 * @property int|null $old_price
 * @property int|null $new_price
 * @property Carbon $changed_at
 */
class ListingPriceChange extends Model
{
    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = ['listing_id', 'old_price', 'new_price', 'changed_at'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'old_price' => 'integer',
            'new_price' => 'integer',
            'changed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Listing, $this> */
    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }
}
