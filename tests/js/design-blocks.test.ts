// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 0.2.6 (аудит G0, R5): эталоны header и footer — снимок блока (локатор `block` из manifest),
// а не страницы на белом поле: белое поле разбавляло долю отличающихся пикселей.
interface Screen {
    id: string;
    block?: string;
    viewports: string[];
    stateReferences?: { state: string; viewports: string[] }[];
}
const manifest = JSON.parse(readFileSync('design/screens/manifest.json', 'utf8')) as {
    screens: Screen[];
};
const pngSize = (file: string): { width: number; height: number } => {
    const bytes = readFileSync(file);
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

describe('эталоны блоков header и footer', () => {
    const blocks = manifest.screens.filter((screen) => ['header', 'footer'].includes(screen.id));

    it('у header и footer в manifest задан block-локатор', () => {
        expect(blocks.map((screen) => [screen.id, screen.block])).toEqual([
            ['header', 'header'],
            ['footer', 'footer'],
        ]);
    });

    for (const screen of blocks) {
        for (const viewport of screen.viewports) {
            it(`${screen.id}@${viewport}: ширина эталона равна ширине viewport`, () => {
                expect(pngSize(`design/screens/${screen.id}@${viewport}.png`).width).toBe(
                    Number(viewport),
                );
            });
        }

        it(`${screen.id}@1440: эталон — блок, а не страница 1440×900`, () => {
            // Блок заметно ниже экрана: доля пикселей считается от самого блока, без белого поля.
            expect(pngSize(`design/screens/${screen.id}@1440.png`).height).toBeLessThan(900);
        });
    }
});

// Ревью PR #99: R1-вид (флаги выключены) — то, что видят пользователи — сверяется с эталонами
// состояния `{id}--{state}@{vp}.png`, снятыми с реализации блоком (принимает OWNER на G1).
describe('эталоны состояния R1 (header, footer)', () => {
    const expected: Record<string, string[]> = { header: ['1440'], footer: ['1440', '390'] };

    for (const [id, viewports] of Object.entries(expected)) {
        it(`${id}: manifest объявляет состояние r1 для ${viewports.join(', ')}`, () => {
            const screen = manifest.screens.find((item) => item.id === id);
            expect(screen?.stateReferences).toEqual([{ state: 'r1', viewports }]);
        });

        for (const viewport of viewports) {
            it(`${id}--r1@${viewport}: файл есть, ширина равна ширине viewport`, () => {
                const size = pngSize(`design/screens/${id}--r1@${viewport}.png`);
                expect(size.width).toBe(Number(viewport));
                expect(size.height).toBeGreaterThan(0);
            });
        }
    }

    it('каждое state: в visual-спеках объявлено в manifest', () => {
        const declared = new Set(
            manifest.screens.flatMap((screen) =>
                (screen.stateReferences ?? []).map((item) => item.state),
            ),
        );
        const dir = 'tests/e2e/visual';
        const used = readdirSync(dir)
            .filter((name) => name.endsWith('.spec.ts'))
            .flatMap((name) =>
                [...readFileSync(`${dir}/${name}`, 'utf8').matchAll(/state: '([^']+)'/g)].map(
                    (match) => match[1],
                ),
            );
        expect(used.length).toBeGreaterThan(0);
        for (const state of used) expect(declared.has(state ?? ''), state).toBe(true);
    });
});
