<?php

declare(strict_types=1);

namespace App\Domain\Listings\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Фото объявления (BR-03). Загрузка, обработка и удаление EXIF — задача 2.1.2.
 *
 * @property int $id
 * @property string $listing_id
 * @property string $path
 * @property int $position
 * @property bool $is_serial
 */
class ListingPhoto extends Model
{
    /** @var list<string> */
    protected $fillable = ['listing_id', 'path', 'position', 'is_serial'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'is_serial' => 'boolean',
        ];
    }

    /** @return BelongsTo<Listing, $this> */
    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }
}
