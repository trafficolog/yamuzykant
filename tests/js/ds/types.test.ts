// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('tsc и дизайн-система', () => {
    it('`tsc --noEmit` проходит: типы @ds берутся из *.d.ts, ListingCardProps строгие', () => {
        const result = spawnSync(
            process.execPath,
            ['node_modules/typescript/bin/tsc', '--noEmit'],
            { cwd: ROOT, encoding: 'utf8' },
        );

        expect(`${result.stdout}${result.stderr}`.trim()).toBe('');
        expect(result.status).toBe(0);
    }, 120_000);
});
