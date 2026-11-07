<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Actions;

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Models\Message;
use Illuminate\Support\Facades\DB;

/**
 * BR-09: при удалении аккаунта переписка обезличивается, а не удаляется у собеседника. Пользователь
 * перестаёт быть участником бесед и автором сообщений; тексты и беседы остаются второй стороне.
 *
 * Вызывается удалением аккаунта (будущая задача кабинета). Если строку пользователя удалят напрямую,
 * то же сделают внешние ключи (`nullOnDelete`).
 */
final class AnonymizeParticipant
{
    public function handle(User $user): void
    {
        DB::transaction(function () use ($user): void {
            Conversation::query()->where('buyer_id', $user->id)->update(['buyer_id' => null]);
            Conversation::query()->where('seller_id', $user->id)->update(['seller_id' => null]);
            Message::query()->where('sender_id', $user->id)->update(['sender_id' => null]);
        });
    }
}
