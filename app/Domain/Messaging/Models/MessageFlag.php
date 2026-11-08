<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Подозрительное сообщение в очереди модерации (4.1.3): коды признаков, без текста. reviewed_at — когда разобрано.
 *
 * @property int $message_id
 * @property list<string> $signals
 * @property Carbon|null $reviewed_at
 * @property Carbon $created_at
 * @property-read Message $message
 */
class MessageFlag extends Model
{
    protected $primaryKey = 'message_id';

    public $incrementing = false;

    /** @var list<string> */
    protected $fillable = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'signals' => 'array',
            'reviewed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Message, $this> */
    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }
}
