import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    expect,
    test,
    type Page,
    type PageAssertionsToHaveScreenshotOptions,
} from '@playwright/test';

// Сверка страницы с эталоном design/screens/{id}@{viewport}.png по design/screens/manifest.json.
// Порог и маски берутся из manifest (DESIGN-SYSTEM.md §6). При расхождении Playwright кладёт
// *-actual.png, *-expected.png и *-diff.png в test-results (артефакт visual-diff в CI).

export interface ManifestViewport {
    name: string;
    width: number;
    height: number;
}

export interface ManifestScreen {
    id: string;
    file: string;
    query: string;
    gate: string;
    compare: 'visual' | 'checklist';
    threshold: string;
    /** Селектор блока: эталон — снимок этого элемента, а не страницы (header, footer). */
    block?: string;
    mask: string[];
    states: string[];
    viewports: string[];
}

export interface Manifest {
    viewports: ManifestViewport[];
    threshold: Record<string, number>;
    screens: ManifestScreen[];
}

export const MANIFEST: Manifest = JSON.parse(
    readFileSync(
        fileURLToPath(new URL('../../../design/screens/manifest.json', import.meta.url)),
        'utf8',
    ),
) as Manifest;

/** Адрес http-server с прототипами (webServer в playwright.config.ts). */
export const PROTOTYPES_BASE = process.env.REF_BASE ?? 'http://127.0.0.1:8123';

export function screenOf(id: string): ManifestScreen {
    const screen = MANIFEST.screens.find((item) => item.id === id);
    if (!screen) throw new Error(`В manifest нет экрана «${id}»`);
    return screen;
}

export function viewportOf(name: string): ManifestViewport {
    const viewport = MANIFEST.viewports.find((item) => item.name === name);
    if (!viewport) throw new Error(`В manifest нет viewport «${name}»`);
    return viewport;
}

/** Допустимая доля отличающихся пикселей для экрана (`threshold` экрана → число из manifest). */
export function thresholdOf(screen: ManifestScreen): number {
    const value = MANIFEST.threshold[screen.threshold];
    if (value === undefined) {
        throw new Error(`Порог «${screen.threshold}» экрана «${screen.id}» не описан в manifest`);
    }
    return value;
}

export function prototypeUrl(id: string): string {
    const screen = screenOf(id);
    return `${PROTOTYPES_BASE}/${encodeURI(screen.file)}${screen.query}`;
}

/** Заморозка анимаций и переходов: `animations: 'disabled'` у скриншота не трогает стили до съёмки. */
export const FREEZE_MOTION_CSS =
    '*, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; caret-color: transparent !important; }';

const reactDir = (name: string): string =>
    dirname(createRequire(import.meta.url).resolve(`${name}/package.json`));

/**
 * Тот же React 18.3.1, что runtime прототипа берёт с unpkg (support.js). Подкладывается до загрузки
 * страницы: бандл ДС выполняется раньше, чем runtime догрузит React с CDN, и при неудачном
 * порядке отрисовка падает с «__ds_scope.h is not a function». Так кадр не зависит от сети.
 */
const REACT_UMD: string[] = [
    readFileSync(join(reactDir('react'), 'umd/react.production.min.js'), 'utf8'),
    readFileSync(join(reactDir('react-dom'), 'umd/react-dom.production.min.js'), 'utf8'),
];

/** Подготовка страницы до перехода: без анимаций, reduced motion, React без CDN. */
export async function prepareDeterministicPage(page: Page): Promise<void> {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const content of REACT_UMD) await page.addInitScript({ content });
    await page.addInitScript((css) => {
        const add = (): void => {
            if (document.getElementById('ym-freeze-motion')) return;
            const style = document.createElement('style');
            style.id = 'ym-freeze-motion';
            style.textContent = css;
            (document.head ?? document.documentElement).append(style);
        };
        if (document.documentElement) add();
        document.addEventListener('DOMContentLoaded', add);
    }, FREEZE_MOTION_CSS);
}

/** Ждёт сеть и шрифты: ни один шрифт не должен оставаться в состоянии loading. */
async function settle(page: Page): Promise<void> {
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(
        () =>
            document.fonts.status === 'loaded' &&
            ![...document.fonts].some((face) => face.status === 'loading'),
    );
}

/** Открывает прототип экрана в viewport из manifest и ждёт шрифты и отрисовку. */
export async function openPrototype(page: Page, id: string, viewportName: string): Promise<void> {
    const viewport = viewportOf(viewportName);
    const errors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await prepareDeterministicPage(page);
    await page.goto(prototypeUrl(id));
    await settle(page);
    await page.waitForTimeout(1500);
    // Прототип с ошибкой отрисовки нельзя сверять: ни самосравнение, ни эталон из него не имеют смысла.
    if (errors.length > 0) {
        throw new Error(`Прототип «${id}» отрисован с ошибками: ${errors.join(' | ')}`);
    }
}

export type ReferenceOptions = Pick<
    PageAssertionsToHaveScreenshotOptions,
    'maxDiffPixelRatio' | 'maxDiffPixels' | 'threshold'
>;

/**
 * Сравнивает уже открытую страницу с эталоном `{id}@{viewportName}.png`: полный экран (или блок
 * `block` из manifest), маски `mask` экрана из manifest, порог `threshold` экрана. `options` переопределяет порог.
 */
export async function expectMatchesReference(
    page: Page,
    id: string,
    viewportName: string,
    options: ReferenceOptions = {},
): Promise<void> {
    const screen = screenOf(id);
    const viewport = viewportOf(viewportName);
    if (!screen.viewports.includes(viewportName)) {
        throw new Error(`У экрана «${id}» нет эталона для viewport «${viewportName}» (manifest)`);
    }

    const referenceFile = `design/screens/${id}@${viewportName}.png`;
    const snapshotName = `${id}@${viewportName}.png`;
    // Эталон копируется туда, где toHaveScreenshot ищет снимок (см. проект references в конфиге).
    const target = test.info().snapshotPath(snapshotName);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(referenceFile, target);

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await settle(page);

    const overridesRatio = options.maxDiffPixels !== undefined;
    const common: PageAssertionsToHaveScreenshotOptions = {
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
        mask: screen.mask.map((selector) => page.locator(selector)),
        ...(overridesRatio ? {} : { maxDiffPixelRatio: thresholdOf(screen) }),
        ...options,
    };
    if (screen.block) {
        // Блок целиком: доля пикселей считается от самого блока, белое поле её не разбавляет (R5).
        await expect(page.locator(screen.block).first()).toHaveScreenshot(snapshotName, common);
    } else {
        await expect(page).toHaveScreenshot(snapshotName, { fullPage: true, ...common });
    }
}
