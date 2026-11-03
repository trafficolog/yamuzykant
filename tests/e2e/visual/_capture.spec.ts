import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { MANIFEST, PROTOTYPES_BASE } from './_helpers';

// 0.2.6: tools/capture-reference.mjs закрашивает маски manifest (как toHaveScreenshot при сверке),
// иначе эталон содержит динамическую зону, а тест её маскирует — различие в каждой такой зоне.
// Скрипт запускается на временном манифесте (REF_MANIFEST) и пишет во временную папку.
const ROOT = join(import.meta.dirname, '../../..');

function capture(mask: string[]): string {
    const dir = mkdtempSync(join(tmpdir(), 'ym-capture-'));
    const footer = MANIFEST.screens.find((screen) => screen.id === 'footer');
    if (!footer) throw new Error('В manifest нет экрана footer');
    const manifest = {
        ...MANIFEST,
        outDir: dir,
        screens: [{ ...footer, viewports: ['1440'], mask }],
    };
    const file = join(dir, 'manifest.json');
    writeFileSync(file, JSON.stringify(manifest));
    execFileSync(process.execPath, ['tools/capture-reference.mjs'], {
        cwd: ROOT,
        env: { ...process.env, REF_MANIFEST: file, REF_BASE: PROTOTYPES_BASE },
        stdio: 'pipe',
    });
    return join(dir, 'footer@1440.png');
}

async function pixelAt(page: Page, file: string, x: number, y: number): Promise<number[]> {
    const data = readFileSync(file).toString('base64');
    return page.evaluate(
        async ({ source, px, py }) => {
            const image = new Image();
            image.src = `data:image/png;base64,${source}`;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext('2d');
            if (!context) throw new Error('canvas недоступен');
            context.drawImage(image, 0, 0);
            return [...context.getImageData(px, py, 1, 1).data];
        },
        { source: data, px: x, py: y },
    );
}

test.describe('@visual capture-reference: маски', () => {
    test('маска из manifest закрашена в эталоне', async ({ page }) => {
        const file = capture(['body']);
        expect(await pixelAt(page, file, 5, 5)).toEqual([255, 0, 255, 255]);
    });

    test('без маски эталон не закрашен', async ({ page }) => {
        const file = capture([]);
        expect(await pixelAt(page, file, 5, 5)).not.toEqual([255, 0, 255, 255]);
    });
});
