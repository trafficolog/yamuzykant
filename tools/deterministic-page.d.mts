import type { Page } from '@playwright/test';

export const FREEZE_MOTION_CSS: string;
export function prepareDeterministicPage(page: Page): Promise<void>;
export function waitForFonts(page: Page): Promise<void>;
