<?php

declare(strict_types=1);

namespace Tests;

use App\Domain\Accounts\Actions\CompleteLogin;
use App\Domain\Accounts\Models\User;
use Illuminate\Contracts\Auth\Authenticatable as UserContract;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase {
        refreshDatabase as private runRefreshDatabase;
    }

    /** Группа теста без базы данных: например, HealthTest (/health работает без БД). */
    public const NO_DATABASE_GROUP = 'no-database';

    /**
     * Каждый тест получает чистую БД. Страницы Inertia читают флаги из таблицы `features`,
     * поэтому Feature- и Unit-тесты работают с БД по умолчанию; исключение — группа NO_DATABASE_GROUP.
     */
    public function refreshDatabase(): void
    {
        if (in_array(self::NO_DATABASE_GROUP, $this->groups(), true)) {
            return;
        }

        // Переключение на :memory: до миграций. RefreshDatabase мигрирует внутри parent::setUp(), и раньше
        // SQLite создавал файл из DB_DATABASE (.env, например `ymuzykant`) в корне проекта. Соединение
        // сбрасывается, чтобы новое читало конфигурацию с :memory:. Вызывать после миграций нельзя: память пропадёт.
        config(['database.connections.sqlite.database' => ':memory:']);
        $this->app->make('db')->purge('sqlite');

        $this->runRefreshDatabase();
    }

    protected function setUp(): void
    {
        parent::setUp();

        // Тесты PHP не должны зависеть от собранных Vite-бандлов (public/build).
        $this->withoutVite();
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
