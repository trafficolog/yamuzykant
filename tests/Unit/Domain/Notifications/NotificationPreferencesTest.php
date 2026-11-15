<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Notifications\Enums\NotificationKind;
use App\Domain\Notifications\NotificationPreferences;

// 1.1.3: настройки писем. Письма отправляет 4.4.1 и спрашивает здесь `allows()`; служебные письма (код входа) вида
// уведомления не имеют и не зависят от настроек.

it('по умолчанию всё включено', function () {
    $user = User::factory()->create(['notification_prefs' => null]);

    expect(NotificationPreferences::allows($user, NotificationKind::NewMessage))->toBeTrue()
        ->and(NotificationPreferences::for($user))->toBe(['new_message' => true, 'price_drop' => true]);
});

it('выключенное уведомление не разрешает письмо', function () {
    $user = User::factory()->create(['notification_prefs' => ['new_message' => false]]);

    expect(NotificationPreferences::allows($user, NotificationKind::NewMessage))->toBeFalse();
});

it('мусор в сохранённых настройках не ломает чтение и считается значением по умолчанию', function () {
    $user = User::factory()->create(['notification_prefs' => ['new_message' => 'нет', 'old_kind' => false]]);

    expect(NotificationPreferences::allows($user, NotificationKind::NewMessage))->toBeTrue()
        ->and(NotificationPreferences::for($user))->toBe(['new_message' => true, 'price_drop' => true]);
});

it('сохраняет только известные виды', function () {
    $user = User::factory()->create(['notification_prefs' => null]);

    NotificationPreferences::update($user, ['new_message' => false, 'bogus' => true]);

    expect($user->refresh()->notification_prefs)->toEqual(['new_message' => false, 'price_drop' => true]);
});

it('каждый вид имеет ключ и значение по умолчанию «включено»', function () {
    foreach (NotificationKind::cases() as $kind) {
        expect($kind->value)->toBeString()->and($kind->enabledByDefault())->toBeTrue();
    }
});
