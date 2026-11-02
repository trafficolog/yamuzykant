import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            'vendor/**',
            'node_modules/**',
            'public/**',
            'bootstrap/**',
            'storage/**',
            'resources/js/ds/**',
            'tools/**',
            'design/**',
            'docs/**',
            'playwright-report/**',
            'test-results/**',
            'coverage/**',
        ],
    },
    { settings: { react: { version: '18' } } },
    js.configs.recommended,
    ...tseslint.configs.strict,
    react.configs.flat.recommended,
    react.configs.flat['jsx-runtime'],
    jsxA11y.flatConfigs.recommended,
    {
        files: ['**/*.{ts,tsx}'],
        plugins: { 'react-hooks': reactHooks },
        languageOptions: {
            globals: { ...globals.browser },
        },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            '@typescript-eslint/no-explicit-any': 'error',
            'react/prop-types': 'off',
        },
    },
    {
        files: ['*.{ts,js}', 'tools/**', 'tests/e2e/**', 'playwright.config.ts'],
        languageOptions: { globals: { ...globals.node } },
    },
    prettier,
);
