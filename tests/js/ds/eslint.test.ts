// @vitest-environment node
import { ESLint } from 'eslint';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const eslint = new ESLint({ cwd: ROOT });

const lint = async (code: string): Promise<string[]> => {
    const [result] = await eslint.lintText(code, {
        filePath: join(ROOT, 'resources/js/Pages/Ds/Probe.tsx'),
    });
    return (result?.messages ?? []).map((m) => `${m.ruleId ?? 'parse'}: ${m.message}`);
};

describe('ESLint: доступ к дизайн-системе только через @ds', () => {
    it('импорт из корня @ds разрешён', async () => {
        expect(await lint("import { Button } from '@ds';\nexport const X = Button;\n")).toEqual([]);
    });

    it.each([
        ['@/ds/components/actions/Button', 'через алиас @/'],
        ['@ds/components/actions/Button', 'через подпуть @ds/*'],
        ['../../ds/components/actions/Button', 'относительным путём'],
        ['../ds/tokens/tokens.json', 'токены относительным путём'],
    ])('запрещает импорт %s (%s)', async (specifier) => {
        const messages = await lint(`import * as X from '${specifier}';\nexport { X };\n`);

        expect(messages.some((m) => m.startsWith('no-restricted-imports'))).toBe(true);
    });
});
