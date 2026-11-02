<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

it('хэширует пароль при присвоении и не отдаёт его при сериализации', function () {
    $user = new User(['name' => 'Анна', 'email' => 'anna@example.com', 'password' => 'secret-password']);
    $user->setAttribute('remember_token', 'token');

    expect($user->password)->not->toBe('secret-password')
        ->and(Hash::check('secret-password', $user->password))->toBeTrue()
        ->and($user->toArray())->not->toHaveKeys(['password', 'remember_token']);
});

it('приводит email_verified_at к дате', function () {
    $user = new User;
    $user->setAttribute('email_verified_at', '2026-11-02 12:00:00');

    expect($user->email_verified_at)->toBeInstanceOf(Carbon::class);
});
