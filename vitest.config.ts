import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@ds': root('./resources/js/ds'),
            '@': root('./resources/js'),
        },
    },
    test: {
        environment: 'jsdom',
        include: ['tests/js/**/*.test.{ts,tsx}'],
        passWithNoTests: true,
        setupFiles: ['tests/js/setup.ts'],
    },
});
