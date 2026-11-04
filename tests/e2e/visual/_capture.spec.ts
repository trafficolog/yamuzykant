import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test, type Page } from '@playwright/test';
import { MANIFEST, PROTOTYPES_BASE } from './_helpers';

// 0.2.6: tools/capture-reference.mjs закрашивает маски manifest (как toHaveScreenshot при сверке),
// иначе эталон содержит динамическую зону, а тест её маскирует — различие в каждой такой зоне.
// Скрипт запускается на временном манифесте (REF_MANIFEST) и пишет во временную папку.
const ROOT = join(import.meta.dirname, '../../..');

const run = promisify(execFile);

// Асинхронно: скрипт ходит на сервер, который тест поднимает в этом же процессе.
async function capture(mask: string[], base = PROTOTYPES_BASE): Promise<string> {
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
    await run(process.execPath, ['tools/capture-reference.mjs'], {
        cwd: ROOT,
        env: { ...process.env, REF_MANIFEST: file, REF_BASE: base },
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
        const file = await capture(['body']);
        expect(await pixelAt(page, file, 5, 5)).toEqual([255, 0, 255, 255]);
    });

    test('без маски эталон не закрашен', async ({ page }) => {
        const file = await capture([]);
        expect(await pixelAt(page, file, 5, 5)).not.toEqual([255, 0, 255, 255]);
    });
});

// Ревью PR #99: прототип с ошибкой консоли не снимается — скрипт завершается с кодом 1.
test.describe('@visual capture-reference: ошибки прототипа', () => {
    test('console.error в прототипе: код выхода 1 и причина в выводе', async () => {
        const server = createServer((request, response) => {
            void fetch(`${PROTOTYPES_BASE}${request.url}`).then(async (upstream) => {
                const type = upstream.headers.get('content-type') ?? '';
                let body: Buffer | string = Buffer.from(await upstream.arrayBuffer());
                if (type.includes('text/html')) {
                    body = body
                        .toString('utf8')
                        .replace('</body>', '<script>console.error("boom")</script></body>');
                }
                response.writeHead(upstream.status, { 'content-type': type });
                response.end(body);
            });
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;

        let status = 0;
        let output = '';
        try {
            await capture([], `http://127.0.0.1:${port}`);
        } catch (error) {
            const failure = error as { code?: number; stdout?: string };
            status = failure.code ?? -1;
            output = String(failure.stdout ?? '');
        } finally {
            server.close();
        }

        expect(status).toBe(1);
        expect(output).toContain('boom');
    });
});
