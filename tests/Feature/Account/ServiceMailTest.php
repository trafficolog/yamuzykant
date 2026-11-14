<?php

declare(strict_types=1);

use App\Domain\Accounts\Mail\LoginCodeMail;
use App\Domain\Accounts\Models\User;
use Illuminate\Support\Facades\Mail;

// 1.1.3: служебные письма (код входа) уходят всегда, даже если выключены все уведомления.

it('код входа приходит пользователю с выключенными уведомлениями', function () {
    Mail::fake();
    User::factory()->create(['email' => 'quiet@example.test', 'notification_prefs' => ['new_message' => false]]);

    $code = requestLoginCode('quiet@example.test');

    expect($code)->toMatch('/^\d{6}$/');
    Mail::assertQueued(LoginCodeMail::class, 1);
});
