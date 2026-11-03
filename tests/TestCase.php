<?php

declare(strict_types=1);

namespace Tests;

use App\Domain\Accounts\Actions\CompleteLogin;
use App\Domain\Accounts\Models\User;
use Illuminate\Contracts\Auth\Authenticatable as UserContract;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Тесты PHP не должны зависеть от собранных Vite-бандлов (public/build).
        $this->withoutVite();

        // SQLite-тесты идут в памяти. DB_DATABASE из .env (pgsql) сюда не должен попадать.
        // Если окружение (например, CI) задаёт DB_CONNECTION=pgsql, тесты идут в PostgreSQL и эта строка ничего не меняет.
        if (config('database.default') === 'sqlite') {
            config(['database.connections.sqlite.database' => ':memory:']);
        }
    }

    /**
     * Как настоящий вход: в сессии есть версия сессий пользователя, иначе
     * EnsureSessionIsCurrent считает сессию устаревшей («выйти на всех устройствах»).
     *
     * @param  string|null  $guard
     */
    public function actingAs(UserContract $user, $guard = null): static
    {
        if ($user instanceof User) {
            $this->withSession([CompleteLogin::SESSION_VERSION_KEY => $user->session_version]);
        }

        return parent::actingAs($user, $guard);
    }
}
