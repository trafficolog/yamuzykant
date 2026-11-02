import { defineConfig, devices } from '@playwright/test';

const PORT = 8000;
const SSR_PORT = 13714;
const baseURL = `http://127.0.0.1:${PORT}`;

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
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    // Для e2e нужны собранные бандлы: `npm run build && npm run build:ssr`.
    webServer: [
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
