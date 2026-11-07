<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Models\Conversation;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Gate;

/*
 * Приватные каналы Reverb (ARCHITECTURE §6). Авторизация — POST /broadcasting/auth с сессией;
 * гость и чужой пользователь получают 403. Несуществующая беседа — тоже отказ.
 */

// Сообщения и «прочитано» беседы — только двум участникам (ConversationPolicy::view).
Broadcast::channel('conversation.{conversation}', fn (User $user, Conversation $conversation): bool => Gate::forUser($user)->allows('view', $conversation));

// Счётчик непрочитанных и уведомления — только самому пользователю.
Broadcast::channel('user.{userId}', fn (User $user, string $userId): bool => (string) $user->id === $userId);
