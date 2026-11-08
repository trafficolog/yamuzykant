import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Данные страницы объявления для e2e (3.1.5): лот из прототипа, похожие и снятое, индекс Meilisearch.
// Сидер идемпотентен и запускается один раз на прогон: параллельные воркеры не гоняются за общими данными.
// Пропустить: E2E_SEED_LOT=0 (когда данные уже есть).
export default function globalSetup(): void {
    if (process.env.E2E_SEED_LOT === '0') return;

    execFileSync('php', ['artisan', 'db:seed', '--class=LotDemoSeeder', '--force'], {
        cwd: fileURLToPath(new URL('../..', import.meta.url)),
        stdio: 'inherit',
    });
}
