// @vitest-environment node
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Критерии 0.2.3: для каждого screens[].viewports из manifest есть непустой PNG-эталон.
interface Viewport {
    name: string;
    width: number;
    height: number;
}
interface Screen {
    id: string;
    block?: string;
    viewports: string[];
}
interface Manifest {
    outDir: string;
    viewports: Viewport[];
    screens: Screen[];
}

const manifest = JSON.parse(readFileSync('design/screens/manifest.json', 'utf8')) as Manifest;

const MIN_BYTES = 30 * 1024;
const MIN_HEIGHT = 900;
// Прототип целиком умещается в один экран (компонент или app-shell на 100vh): fullPage-снимок не выше
// viewport, и «высота > 900» к нему неприменима. Такие снимки проверяются на «не короче viewport»,
// «шапка» (почти вся белая) — на размер от 15 КБ. Список согласован в PR задачи 0.2.3.
const SINGLE_SCREEN = new Set(['header@390', 'emails@1440', 'console-tickets@1440']);
const LIGHT_FILES = new Set(['header@390']);
const MIN_BYTES_LIGHT = 15 * 1024;
// 0.2.6: эталоны header и footer — снимок блока (`block` в manifest), а не страницы: высота ниже
// экрана, файл небольшой. Проверяем сигнатуру PNG, ширину и непустой размер.
const MIN_BYTES_BLOCK = 4 * 1024;

const PNG_SIGNATURE = '89504e470d0a1a0a';

const cases = manifest.screens.flatMap((screen) =>
    screen.viewports.map((vpName) => {
        const viewport = manifest.viewports.find((vp) => vp.name === vpName);
        if (!viewport) throw new Error(`Во viewports manifest нет «${vpName}»`);
        return {
            id: screen.id,
            viewport,
            block: screen.block,
            file: `${manifest.outDir}/${screen.id}@${vpName}.png`,
        };
    }),
);

describe('эталоны design/screens', () => {
    it('manifest содержит экраны и оба viewport', () => {
        expect(cases.length).toBeGreaterThan(0);
        expect(manifest.viewports.map((vp) => vp.name)).toEqual(['1440', '390']);
    });

    it.each(cases)('$id@$viewport.name: PNG существует', ({ file }) => {
        expect(existsSync(file)).toBe(true);
    });

    it.each(cases)('$id@$viewport.name: снимок не пустой (> 30 КБ, высота > 900 px)', (c) => {
        const bytes = readFileSync(c.file);
        expect(bytes.subarray(0, 8).toString('hex')).toBe(PNG_SIGNATURE);
        const key = `${c.id}@${c.viewport.name}`;
        const minBytes = c.block
            ? MIN_BYTES_BLOCK
            : LIGHT_FILES.has(key)
              ? MIN_BYTES_LIGHT
              : MIN_BYTES;
        expect(statSync(c.file).size).toBeGreaterThan(minBytes);

        const width = bytes.readUInt32BE(16);
        const height = bytes.readUInt32BE(20);
        expect(width).toBe(c.viewport.width);
        if (c.block) {
            expect(height).toBeGreaterThan(0);
        } else if (SINGLE_SCREEN.has(key)) {
            expect(height).toBeGreaterThanOrEqual(c.viewport.height);
        } else {
            expect(height).toBeGreaterThan(MIN_HEIGHT);
        }
    });
});
