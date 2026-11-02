// Словарь запрещённых слов (AGENTS.md §5) и выбор маршрутов для copy.spec.ts.
// Его использует lint-copy (исходники) и tests/e2e/copy.spec.ts (отрисованный innerText).
// Записи должны совпадать с таблицей AGENTS.md §5: это проверяет lint-copy.test.mjs.

export const FORBIDDEN = [
    { word: 'гир', re: /(^|[^а-яё])гир(ами|ах|ам|ов|ом|а|е|ы|у)?(?![а-яё])/i, hint: 'инструмент / оборудование' },
    { word: 'мой гир', re: /мой\s+гир/i, hint: 'мои инструменты' },
    { word: 'сетап', re: /сетап/i, hint: 'настройка' },
    { word: 'ля440', re: /(^|[^а-яёa-z0-9])ля\s?440/i, hint: 'Цены продаж' },
    { word: 'фермата', re: /фермат/i, hint: 'Безопасная сделка (в MVP не показываем)' },
    { word: 'по рукам', re: /по\s+рукам/i, hint: 'Цена согласована' },
    { word: 'кофр-доставка', re: /кофр[\s\-‑]доставк/i, hint: 'Доставка в защитной упаковке' },
    { word: 'ладмастер', re: /ладмастер/i, hint: 'ЯМузыкант' },
    { word: 'ладмир', re: /ладмир/i, hint: 'ЯМузыкант' },
];

// Запрещённые слова в тексте: [{ word, hint }] в порядке словаря; пустой массив — текст чистый.
export function findForbidden(text) {
    return FORBIDDEN.filter((entry) => entry.re.test(text)).map(({ word, hint }) => ({ word, hint }));
}

// Служебные маршруты: витрина ДС, health, Ignition, API и т. п. — не публичные страницы.
const SERVICE = [
    /^_ds(\/|$)/,
    /^_/,
    /^health$/,
    /^up$/,
    /^(api|storage|sanctum|broadcasting|livewire)(\/|$)/,
];

// Публичные страницы для copy.spec: из `php artisan route:list --json`.
// Берём GET/HEAD без параметров в пути, без middleware auth*, без служебных префиксов.
export function pickRoutes(list) {
    const paths = list
        .filter((route) => route.method.split('|').includes('GET'))
        .filter((route) => !route.uri.includes('{'))
        .filter((route) => !(route.middleware ?? []).some((m) => m.startsWith('auth')))
        .map((route) => route.uri.replace(/^\/+/, ''))
        .filter((uri) => !SERVICE.some((re) => re.test(uri)))
        .map((uri) => `/${uri}`);
    return [...new Set(paths)].sort();
}
