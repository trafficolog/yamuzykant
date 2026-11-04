import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { FLAG_NAMES } from '@/Hooks/useFlag';

import { parseFlagEnumCases } from '../support/flagEnum';

// Флаг `delivery_service` (0.2.7) должен попасть и в enum, и в FLAG_NAMES: сверка ниже это проверит.

// Vitest запускается из корня репозитория (npm run test:js); в jsdom import.meta.url не file:-URL.
const ENUM_PATH = join(process.cwd(), 'app/Support/Flags/FeatureFlag.php');

/** Значения case-ов backed enum FeatureFlag: единственный источник списка флагов. */
function enumFlagNames(): string[] {
    return parseFlagEnumCases(readFileSync(ENUM_PATH, 'utf8'));
}

describe('FlagName сверяется с enum FeatureFlag', () => {
    it('enum FeatureFlag читается и содержит флаги', () => {
        expect(enumFlagNames().length).toBeGreaterThan(0);
    });

    it('FLAG_NAMES совпадает с enum: новый флаг в enum без правки FlagName роняет тест', () => {
        expect([...FLAG_NAMES].sort()).toEqual([...enumFlagNames()].sort());
    });

    it('в FLAG_NAMES нет повторов', () => {
        expect(new Set(FLAG_NAMES).size).toBe(FLAG_NAMES.length);
    });
});
