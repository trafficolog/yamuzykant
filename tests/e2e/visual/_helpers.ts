import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
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

async function settle(page: Page): Promise<void> {
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
}

/** Открывает прототип экрана в viewport из manifest и ждёт шрифты и отрисовку. */
export async function openPrototype(page: Page, id: string, viewportName: string): Promise<void> {
    const viewport = viewportOf(viewportName);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(prototypeUrl(id));
    await settle(page);
    await page.waitForTimeout(1500);
}

export type ReferenceOptions = Pick<
    PageAssertionsToHaveScreenshotOptions,
    'maxDiffPixelRatio' | 'maxDiffPixels' | 'threshold'
>;

/**
 * Сравнивает уже открытую страницу с эталоном `{id}@{viewportName}.png`: полный экран, маски
 * `mask` экрана из manifest, порог `threshold` экрана. `options` переопределяет порог.
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
    await expect(page).toHaveScreenshot(snapshotName, {
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
        mask: screen.mask.map((selector) => page.locator(selector)),
        ...(overridesRatio ? {} : { maxDiffPixelRatio: thresholdOf(screen) }),
        ...options,
    });
}
