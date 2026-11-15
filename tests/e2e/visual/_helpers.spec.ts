import { readdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { expectMatchesReference, openPrototype, STRICT_RATIO } from './_helpers';

// Каркас визуальных тестов (0.2.3): хелпер сверяет страницу с эталоном design/screens по manifest.
// Самосравнение: прототип «Подвал» против эталона footer, снятого с него же.
test.describe('@visual хелпер сверки с эталоном', () => {
    for (const viewport of ['1440', '390']) {
        test(`footer@${viewport}: прототип совпадает со своим эталоном`, async ({ page }) => {
            await openPrototype(page, 'footer', viewport);
            await expectMatchesReference(page, 'footer', viewport, { maxDiffPixels: 0 });
        });
    }

    // 0.2.6: детерминизм. Анимации и переходы отключены, шрифты дождались — иначе самосравнение
    // изредка ловит кадр посередине перехода (флак footer@1440 в CI был скрыт retries: 1).
    test('openPrototype отключает анимации и переходы', async ({ page }) => {
        await openPrototype(page, 'footer', '1440');

        const state = await page.evaluate(() => {
            const probe = document.createElement('div');
            probe.style.cssText = 'animation: probe 1s infinite; transition: opacity 1s;';
            document.body.append(probe);
            const style = getComputedStyle(probe);
            return {
                reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
                animationName: style.animationName,
                transitionDuration: style.transitionDuration,
                running: document.getAnimations().length,
            };
        });

        expect(state.reduced).toBe(true);
        expect(state.animationName).toBe('none');
        expect(state.transitionDuration).toBe('0s');
        expect(state.running).toBe(0);
    });

    // Источник флака: бандл ДС выполняется до того, как runtime прототипа догрузил React с unpkg, и
    // иногда (в зависимости от задержек сети) отрисовка падает с «__ds_scope.h is not a function».
    // Эталон тогда нарисован с ошибкой, а самосравнение зелёное или красное «как повезёт».
    test('openPrototype: прототип отрисован без ошибок runtime и бандла ДС', async ({ page }) => {
        const errors: string[] = [];
        page.on('console', (message) => {
            if (message.type() === 'error') errors.push(message.text());
        });
        page.on('pageerror', (error) => errors.push(error.message));

        await openPrototype(page, 'footer', '1440');

        const state = await page.evaluate(() => ({
            bundleErrors: (window as unknown as { DesignSystem_b66810?: { __errors?: unknown[] } })
                .DesignSystem_b66810?.__errors,
            text: document.body.innerText,
        }));
        expect(errors).toEqual([]);
        expect(state.bundleErrors).toEqual([]);
        expect(state.text).not.toContain('is not a function');
        expect(state.text).toContain('Пользовательское соглашение');
    });

    test('openPrototype не ходит за React на unpkg: сеть не влияет на кадр', async ({ page }) => {
        const external: string[] = [];
        page.on('request', (request) => {
            if (new URL(request.url()).hostname === 'unpkg.com') external.push(request.url());
        });

        await openPrototype(page, 'footer', '1440');

        expect(external).toEqual([]);
    });

    test('openPrototype дожидается шрифтов: ни один не в состоянии loading', async ({ page }) => {
        await openPrototype(page, 'footer', '1440');

        const fonts = await page.evaluate(() => ({
            status: document.fonts.status,
            loading: [...document.fonts].filter((face) => face.status === 'loading').length,
            loaded: [...document.fonts].filter((face) => face.status === 'loaded').length,
        }));

        expect(fonts.status).toBe('loaded');
        expect(fonts.loading).toBe(0);
        expect(fonts.loaded).toBeGreaterThan(0);
    });

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

    test('состояние: эталон {id}--{state}@{vp}.png; необъявленное состояние — понятная ошибка', async ({
        page,
    }) => {
        await expect(
            expectMatchesReference(page, 'footer', '1440', { state: 'нет-такого' }),
        ).rejects.toThrow(/footer--нет-такого@1440\.png/);
    });

    // Прототип с ошибкой консоли нельзя ни сверять, ни снимать (ревью PR #99).
    test('прототип с ошибкой консоли: openPrototype падает', async ({ page }) => {
        await page.route(/Подвал|%D0%9F%D0%BE%D0%B4%D0%B2%D0%B0%D0%BB/, async (route) => {
            const response = await route.fetch();
            const body = (await response.text()).replace(
                '</body>',
                '<script>console.error("boom")</script></body>',
            );
            await route.fulfill({ response, body });
        });

        await expect(openPrototype(page, 'footer', '1440')).rejects.toThrow(/ошибками.*boom/);
    });

    test('неизвестный экран или viewport: понятная ошибка', async ({ page }) => {
        await expect(expectMatchesReference(page, 'нет-такого', '1440')).rejects.toThrow(
            /manifest/,
        );
        await expect(expectMatchesReference(page, 'footer', '768')).rejects.toThrow(/viewport/);
    });

    // 0.2.9: эталон состояния снят с реализации, порог строгий. Фикстура: страница — сам эталон home--r1@1440
    // (картинка), к ней добавляется блок ≈ 1,5 % площади. Под порогом 5 % сверки с прототипом такое проходило.
    test.describe('строгий порог эталонов состояния', () => {
        const IMAGE = `data:image/png;base64,${readFileSync('design/screens/home--r1@1440.png').toString('base64')}`;

        const fixture = async (page: Page, overlayPercent: number) => {
            await page.setViewportSize({ width: 1440, height: 900 });
            await page.setContent(
                `<body style="margin:0"><img id="shot" src="${IMAGE}" style="display:block;width:1440px"></body>`,
            );
            const height = await page
                .locator('#shot')
                .evaluate((img: HTMLImageElement) => img.decode().then(() => img.clientHeight));
            if (overlayPercent === 0) return;
            await page.evaluate(
                (px) => {
                    const div = document.createElement('div');
                    div.style.cssText = `position:absolute;top:0;left:0;width:1440px;height:${px}px;background:#f0f`;
                    document.body.append(div);
                },
                Math.round((height * overlayPercent) / 100),
            );
        };

        test('порог по умолчанию — 0,5 %', () => {
            expect(STRICT_RATIO).toBe(0.005);
        });

        test('точная копия эталона проходит', async ({ page }) => {
            await fixture(page, 0);
            await expectMatchesReference(page, 'home', '1440', { state: 'r1' });
        });

        test('отличие ≈ 1,5 % площади роняет сверку по умолчанию', async ({ page }) => {
            await fixture(page, 1.5);
            await expect(
                expectMatchesReference(page, 'home', '1440', { state: 'r1' }),
            ).rejects.toThrow();
        });

        test('ослабление возможно только явным maxDiffPixelRatio', async ({ page }) => {
            await fixture(page, 1.5);
            await expectMatchesReference(page, 'home', '1440', {
                state: 'r1',
                maxDiffPixelRatio: 0.02,
            });
        });
    });
});
