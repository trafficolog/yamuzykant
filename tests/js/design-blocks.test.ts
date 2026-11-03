// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 0.2.6 (аудит G0, R5): эталоны header и footer — снимок блока (локатор `block` из manifest),
// а не страницы на белом поле: белое поле разбавляло долю отличающихся пикселей.
interface Screen {
    id: string;
    block?: string;
    viewports: string[];
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
