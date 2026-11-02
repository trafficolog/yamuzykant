import React from "react";
import { h } from "../core/shared.js";
import { Icon } from "./Icon.jsx";
import { Wordmark } from "./Wordmark.jsx";
/* Footer — структура: полоса сервисов → колонки ссылок + контакты → юридическая строка */
export const FOOTER_SERVICES = [['Каталог', 'layout-grid'], ['Барахолка', 'boxes'], ['Аксессуары', 'cable'], ['Мастера', 'wrench'], ['Цены на б/у', 'sliders-horizontal'], ['Безопасная сделка', 'shield-check'], ['Доставка с упаковкой', 'truck']];
export const FOOTER_COLUMNS = [
  ['О ЯМузыканте', ['О проекте', 'Вакансии', 'Журнал', 'Для прессы']],
  ['Продавцам и мастерам', ['Продать инструмент', 'Магазинам-партнёрам', 'Стать мастером', 'Кабинет мастерской']],
  ['Полезно', ['Как выбрать б/у инструмент', 'Цены на б/у', 'Правила размещения', 'Правовые документы']],
  ['Безопасность', ['Как работает безопасная сделка', 'Как не попасть на мошенников', 'Споры и возвраты']]
];
export const FOOTER_LEGAL = ['Пользовательское соглашение', 'Политика обработки персональных данных', 'Политика cookie'];
export function Footer(p) {
  var services = p.services || FOOTER_SERVICES, columns = p.columns || FOOTER_COLUMNS, legal = p.legal || FOOTER_LEGAL;
  var social = p.social || ['Telegram', 'ВКонтакте', 'YouTube'];
  var compact = p.variant === 'compact';
  return h('footer', { className: 'ym-footer' + (compact ? ' ym-footer--compact' : '') },
    h('div', { className: 'ym-footer__in' },
      !compact && h('nav', { className: 'ym-footer__services', 'aria-label': 'Сервисы' },
        services.map(function (s) { return h('a', { key: s[0], href: '#', className: 'ym-footer__service' }, h(Icon, { name: s[1], size: 16 }), s[0]); })),
      !compact && h('div', { className: 'ym-footer__grid' },
        columns.map(function (c) { return h('div', { key: c[0], className: 'ym-footer__col' }, h('h3', { className: 'ym-footer__h' }, c[0]),
          h('ul', null, c[1].map(function (l) { return h('li', { key: l }, h('a', { href: '#', className: 'ym-footer__link' }, l)); }))); }),
        h('div', { className: 'ym-footer__col ym-footer__contacts' }, h('h3', { className: 'ym-footer__h' }, 'Поддержка'),
          h('a', { href: '#', className: 'ym-footer__help' }, h(Icon, { name: 'message-circle', size: 16 }), 'Написать в поддержку'),
          h('p', { className: 'ym-footer__note' }, p.hours || 'Ежедневно, 9:00–21:00 мск'),
          p.email !== false && h('a', { href: 'mailto:' + (p.email || 'help@yamuzykant.ru'), className: 'ym-footer__link' }, p.email || 'help@yamuzykant.ru'),
          social.length > 0 && h('div', { className: 'ym-footer__social' }, social.map(function (s) { return h('a', { key: s, href: '#', className: 'ym-footer__chip' }, s); })))),
      h('div', { className: 'ym-footer__bottom' },
        h('div', { className: 'ym-footer__brand' }, h(Wordmark, { size: 20, href: '#' }), h('span', { className: 'ym-footer__note' }, p.copyright || '© 2026 ЯМузыкант. Цены указаны в рублях.')),
        h('ul', { className: 'ym-footer__legal' }, legal.map(function (l) { return h('li', { key: l }, h('a', { href: '#', className: 'ym-footer__link ym-footer__link--s' }, l)); })))));
}
