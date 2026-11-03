import { readdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { expectMatchesReference, openPrototype } from './_helpers';

// Каркас визуальных тестов (0.2.3): хелпер сверяет страницу с эталоном design/screens по manifest.
// Самосравнение: прототип «Подвал» против эталона footer, снятого с него же.
test.describe('@visual хелпер сверки с эталоном', () => {
    for (const viewport of ['1440', '390']) {
        test(`footer@${viewport}: прототип совпадает со своим эталоном`, async ({ page }) => {
            await openPrototype(page, 'footer', viewport);
            await expectMatchesReference(page, 'footer', viewport, { maxDiffPixels: 0 });
        });
    }

    test('превышение порога: хелпер падает, diff-изображение лежит в артефактах теста', async ({
        page,
    }, testInfo) => {
        await openPrototype(page, 'footer', '1440');
        await page.addStyleTag({ content: 'html { filter: invert(1); }' });

        await expect(expectMatchesReference(page, 'footer', '1440')).rejects.toThrow();

        const artifacts = readdirSync(testInfo.outputDir);
        expect(artifacts.some((name) => name.endsWith('-diff.png'))).toBe(true);
        expect(artifacts.some((name) => name.endsWith('-actual.png'))).toBe(true);
    });

    test('неизвестный экран или viewport: понятная ошибка', async ({ page }) => {
        await expect(expectMatchesReference(page, 'нет-такого', '1440')).rejects.toThrow(
            /manifest/,
        );
        await expect(expectMatchesReference(page, 'footer', '768')).rejects.toThrow(/viewport/);
    });
});
