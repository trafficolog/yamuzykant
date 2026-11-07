import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

// Релиз Sentry для браузера = git sha. Сборка идёт в releases/<UTC>-<sha12> (deploy.sh), отсюда берётся sha;
// VITE_SENTRY_RELEASE, если задана, главнее.
const releaseDir = /-([0-9a-f]{12})$/.exec(basename(process.cwd()));
if (releaseDir?.[1] !== undefined) {
    process.env.VITE_SENTRY_RELEASE ||= releaseDir[1];
}

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            ssr: 'resources/js/ssr.tsx',
            refresh: true,
        }),
        react(),
    ],
    resolve: {
        alias: {
            '@ds': root('./resources/js/ds'),
            '@': root('./resources/js'),
        },
    },
});
