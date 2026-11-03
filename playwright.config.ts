import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 8000;
const SSR_PORT = 13714;
const PROTOTYPES_PORT = 8123;
const baseURL = `http://127.0.0.1:${PORT}`;

// Визуальные тесты по эталонам design/screens (0.2.3). Витрина /_ds остаётся в проекте chromium
// со снимками рядом с тестом.
const referenceSpecs = /visual\/(?!ds\.visual)[^/]+\.spec\.ts$/;

export default defineConfig({
    testDir: 'tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL,
        trace: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            testIgnore: referenceSpecs,
            use: { ...devices['Desktop Chrome'] },
        },
        {
            // Эталоны design/screens/{id}@{viewport}.png Playwright сам найти не может: он заменяет «@»
            // в имени снимка. Хелпер копирует эталон во временную папку, где его ждёт toHaveScreenshot;
            // сами эталоны тест не меняет даже с --update-snapshots (_helpers.ts). {testName} в пути: тесты
            // одного эталона идут параллельно, и общий файл копировали одновременно («Could not decode PNG»).
            name: 'references',
            // Без ретраев: повтор скрывал флаки сверки (0.2.6), эталон либо совпал, либо нет.
            retries: 0,
            testMatch: referenceSpecs,
            snapshotDir: join(tmpdir(), 'ym-references'),
            snapshotPathTemplate: '{snapshotDir}/{testFileName}/{testName}/{arg}{ext}',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    // Для e2e нужны собранные бандлы: `npm run build && npm run build:ssr`.
    webServer: [
        {
            // Прототипам нужен http, не file://.
            command: `npx http-server design/prototypes -a 127.0.0.1 -p ${PROTOTYPES_PORT} -s -c-1`,
            url: `http://127.0.0.1:${PROTOTYPES_PORT}/support.js`,
            reuseExistingServer: !process.env.CI,
            timeout: 30_000,
        },
        {
            command: `php artisan serve --host=127.0.0.1 --port=${PORT}`,
            url: `${baseURL}/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 60_000,
        },
        {
            command: 'php artisan inertia:start-ssr',
            url: `http://127.0.0.1:${SSR_PORT}/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 60_000,
        },
    ],
});
