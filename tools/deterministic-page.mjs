// Общий для съёмки эталонов (capture-reference.mjs) и сверки (tests/e2e/visual/_helpers.ts):
// страница без анимаций, с React без CDN и с дождавшимися шрифтами. Один код — один и тот же кадр.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/** Заморозка анимаций и переходов: `animations: 'disabled'` у скриншота не трогает стили до съёмки. */
export const FREEZE_MOTION_CSS =
  '*, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; caret-color: transparent !important; }';

const reactDir = name => dirname(createRequire(import.meta.url).resolve(`${name}/package.json`));

// Тот же React 18.3.1, что runtime прототипа берёт с unpkg (support.js). Подкладывается до загрузки
// страницы: бандл ДС выполняется раньше, чем runtime догрузит React с CDN, и при неудачном порядке
// отрисовка падает с «__ds_scope.h is not a function». Так кадр не зависит от сети.
const REACT_UMD = [
  readFileSync(join(reactDir('react'), 'umd/react.production.min.js'), 'utf8'),
  readFileSync(join(reactDir('react-dom'), 'umd/react-dom.production.min.js'), 'utf8'),
];

/** Подготовка страницы до перехода: reducedMotion, стиль без анимаций, React без CDN. */
export async function prepareDeterministicPage(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const content of REACT_UMD) await page.addInitScript({ content });
  await page.addInitScript(css => {
    const add = () => {
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

/** Ждёт шрифты: ни один не должен оставаться в состоянии loading. */
export async function waitForFonts(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.fonts.status === 'loaded' && ![...document.fonts].some(f => f.status === 'loading'));
}
