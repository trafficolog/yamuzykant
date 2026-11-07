import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Данные Барахолки для e2e (3.1.2): объявления из прототипа в Москве и одно в Казани, индекс Meilisearch.
// Сидер идемпотентен и один раз на прогон: параллельные воркеры не гоняются за общими данными.
// Пропустить: E2E_SEED_FLEA=0 (когда данные уже есть).
export default function globalSetup(): void {
    if (process.env.E2E_SEED_FLEA === '0') return;

    execFileSync('php', ['artisan', 'db:seed', '--class=FleaDemoSeeder', '--force'], {
        cwd: fileURLToPath(new URL('../..', import.meta.url)),
        stdio: 'inherit',
    });
}
