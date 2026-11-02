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
const PNG_SIGNATURE = '89504e470d0a1a0a';

const cases = manifest.screens.flatMap((screen) =>
    screen.viewports.map((vpName) => {
        const viewport = manifest.viewports.find((vp) => vp.name === vpName);
        if (!viewport) throw new Error(`Во viewports manifest нет «${vpName}»`);
        return { id: screen.id, viewport, file: `${manifest.outDir}/${screen.id}@${vpName}.png` };
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
        expect(statSync(c.file).size).toBeGreaterThan(MIN_BYTES);

        const width = bytes.readUInt32BE(16);
        const height = bytes.readUInt32BE(20);
        expect(width).toBe(c.viewport.width);
        expect(height).toBeGreaterThan(MIN_HEIGHT);
    });
});
