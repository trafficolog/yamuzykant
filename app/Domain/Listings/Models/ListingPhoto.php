<?php

declare(strict_types=1);

namespace App\Domain\Listings\Models;

use App\Domain\Listings\Photos\PhotoFormat;
use App\Domain\Listings\Photos\PhotoVariant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Фото объявления (BR-03). Исходник лежит по upload_key только до перекодирования (job ProcessListingPhoto)
 * и наружу не отдаётся; показываются версии из каталога `path` — 1:1 и 4:3 в WebP и AVIF, без EXIF.
 *
 * Состояние: в обработке (processed_at и failed_reason пусты), готово (processed_at), ошибка (failed_reason).
 *
 * @property int $id
 * @property string $listing_id
 * @property string $path
 * @property string|null $upload_key
 * @property int $position
 * @property bool $is_serial
 * @property string|null $phash
 * @property Carbon|null $processed_at
 * @property string|null $failed_reason
 * @property-read Listing $listing
 */
class ListingPhoto extends Model
{
    /**
     * Результат обработки (phash, processed_at, failed_reason) пишет только job — через forceFill.
     *
     * @var list<string>
     */
    protected $fillable = ['listing_id', 'path', 'upload_key', 'position', 'is_serial'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'is_serial' => 'boolean',
            'processed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Listing, $this> */
    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class);
    }

    public function isReady(): bool
    {
        return $this->processed_at !== null;
    }

    public function isFailed(): bool
    {
        return $this->failed_reason !== null;
    }

    /** Путь отдаваемой версии в хранилище. */
    public function variantPath(PhotoVariant $variant, PhotoFormat $format): string
    {
        return "{$this->path}/{$variant->value}.{$format->value}";
    }

    /**
     * Фото, которые считаются в лимитах BR-03: всё, кроме неудачно обработанных.
     *
     * @param  Builder<ListingPhoto>  $query
     */
    public function scopeCounted(Builder $query): void
    {
        $query->whereNull('failed_reason');
    }
}
