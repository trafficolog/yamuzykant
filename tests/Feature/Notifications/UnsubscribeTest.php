<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use Illuminate\Support\Facades\URL;

// 4.4.1: отписка в один клик — по подписанной ссылке из письма, без входа.

function unsubscribeUrl(User $user, string $kind = 'new_message'): string
{
    return URL::signedRoute('notifications.unsubscribe', ['user' => $user->id, 'kind' => $kind]);
}

it('переход по ссылке (GET) только показывает подтверждение: сканеры почты не отписывают', function () {
    $user = User::factory()->create(['notification_prefs' => null]);
    $url = unsubscribeUrl($user);

    $this->get($url)
        ->assertOk()
        ->assertSee('Отписаться от писем о новых сообщениях?')
        ->assertSee('method="POST"', false)
        ->assertSee('action="'.e($url).'"', false);

    expect($user->refresh()->notification_prefs)->toBeNull();
});

it('кнопка подтверждения (POST) выключает письма этого вида', function () {
    $user = User::factory()->create(['notification_prefs' => null]);

    $this->post(unsubscribeUrl($user))
        ->assertOk()
        ->assertSee('Вы отписались от писем о новых сообщениях')
        ->assertSee('Настроить уведомления');

    expect($user->refresh()->notification_prefs)->toEqual(['new_message' => false, 'price_drop' => true]);
});

it('POST «в один клик» почтового клиента (RFC 8058) отписывает сразу и без CSRF-токена', function () {
    $user = User::factory()->create();

    $this->post(unsubscribeUrl($user), ['List-Unsubscribe' => 'One-Click'])->assertOk();

    expect($user->refresh()->notification_prefs)->toEqual(['new_message' => false, 'price_drop' => true]);
});

it('без подписи или с чужой подписью — 403, настройки не меняются', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    $this->get("/notifications/unsubscribe/{$user->id}/new_message")->assertForbidden();
    $this->get(str_replace("/{$other->id}/", "/{$user->id}/", unsubscribeUrl($other)))->assertForbidden();

    expect($user->refresh()->notification_prefs)->toBeNull();
});

it('неизвестный вид — 404', function () {
    $user = User::factory()->create();

    $this->get(unsubscribeUrl($user, 'bogus'))->assertNotFound();
});
