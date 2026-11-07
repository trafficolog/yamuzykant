import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Окружения, где базу можно чистить из тестов: CI (e2e) и тестовая (testing). */
export const DISPOSABLE_ENVIRONMENTS = ['e2e', 'testing'] as const;

/** Отказ, если приложение запущено не в одноразовом окружении: тест не должен трогать чужую базу. */
export function assertDisposableEnvironment(environment: string | null | undefined): void {
    const name = (environment ?? '').trim();
    if (!(DISPOSABLE_ENVIRONMENTS as readonly string[]).includes(name)) {
        throw new Error(
            `Тест удаляет пользователей и работает только при APP_ENV=${DISPOSABLE_ENVIRONMENTS.join(' или ')}; сейчас: «${name || 'не определено'}»`,
        );
    }
}

/** Окружение приложения глазами artisan: `The application environment is [e2e]`. */
export function applicationEnvironment(): string {
    const output = execFileSync('php', ['artisan', 'env'], { cwd: APP_ROOT, encoding: 'utf8' });
    return output.match(/\[([^\]]+)\]/)?.[1] ?? '';
}

/**
 * Тестовый пользователь Яндекс ID (FakeYandexProvider::USER) создаётся при первом входе и остаётся в базе.
 * Перед тестом удаляем его: сценарий «первый вход» не зависит от прошлых прогонов и повторов CI.
 * Только при APP_ENV=e2e или testing.
 */
export function forgetYandexTestUser(): void {
    assertDisposableEnvironment(applicationEnvironment());

    execFileSync(
        'php',
        [
            'artisan',
            'tinker',
            "--execute=App\\Domain\\Accounts\\Models\\User::query()->where('email', 'yandex-test@example.com')->orWhere('yandex_id', '1130000000000001')->delete();",
        ],
        { cwd: APP_ROOT, stdio: 'ignore' },
    );
}
