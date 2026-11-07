<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Models;

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Enums\MessageKind;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Сообщение беседы (SPEC §7 MESSAGE). read_at — когда прочитал получатель. sender_id null —
 * системное сообщение или автор удалил аккаунт (BR-09).
 *
 * @property int $id
 * @property string $conversation_id
 * @property int|null $sender_id
 * @property MessageKind $kind
 * @property string $body
 * @property Carbon|null $read_at
 * @property Carbon $created_at
 * @property-read Conversation $conversation
 * @property-read User|null $sender
 */
class Message extends Model
{
    /** @var list<string> */
    protected $fillable = [];

    /** @var array<string, mixed> */
    protected $attributes = [
        'kind' => 'text',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'sender_id' => 'integer',
            'kind' => MessageKind::class,
            'read_at' => 'datetime',
        ];
    }

    /**
     * Поля для трансляции в канал беседы — явный список, без данных пользователей (BR-04).
     *
     * @return array{id: int, conversation_id: string, kind: string, body: string, sender_id: int|null, created_at: string}
     */
    public function broadcastPayload(): array
    {
        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'kind' => $this->kind->value,
            'body' => $this->body,
            'sender_id' => $this->sender_id,
            'created_at' => $this->created_at->toIso8601ZuluString(),
        ];
    }

    /** @return BelongsTo<Conversation, $this> */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /** @return BelongsTo<User, $this> */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }
}
