import React from "react";
import { h, nf, rub } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
import { plural } from "./OfferList.jsx";
/* ModelSummary — шапка карточки модели: новое у партнёров и б/у на барахолке рядом */
export function ModelSummary(p) {
  return h('section', { className: 'ym-model', 'aria-label': 'Модель ' + p.name },
    h('div', { className: 'ym-card__meta' }, p.category),
    h('h1', { className: 'ym-model__name ym-title' }, p.name),
    p.specs && p.specs.length ? h('ul', { className: 'ym-model__specs' }, p.specs.map(function (x, i) { return h('li', { key: i }, x); })) : null,
    h('div', { className: 'ym-model__split' },
      h('a', { href: p.newHref || '#offers-new', className: 'ym-model__tile' },
        h('span', { className: 'ym-model__k' }, h(Icon, { name: 'store', size: 16 }), 'Новое у партнёров'),
        h('span', { className: 'ym-model__v' }, p.newFrom != null ? 'от ' + rub(p.newFrom) : 'нет в наличии'),
        h('span', { className: 'ym-model__c' }, p.newCount ? p.newCount + ' ' + plural(p.newCount, ['предложение', 'предложения', 'предложений']) + (p.warranty ? ' · гарантия производителя' : '') : 'Сообщим, когда появится')),
      h('a', { href: p.usedHref || '#offers-used', className: 'ym-model__tile' },
        h('span', { className: 'ym-model__k' }, h(Icon, { name: 'boxes', size: 16 }), 'Б/у на барахолке'),
        h('span', { className: 'ym-model__v' }, p.usedFrom != null ? 'от ' + rub(p.usedFrom) : 'пока нет лотов'),
        h('span', { className: 'ym-model__c' }, p.usedCount ? p.usedCount + ' ' + plural(p.usedCount, ['лот', 'лота', 'лотов']) + ' · безопасная сделка' : 'Подпишитесь на модель'))),
    p.guide ? h('div', { className: 'ym-card__meta' }, h(Icon, { name: 'sliders-horizontal', size: 16 }), 'Цены на б/у: ' + nf.format(p.guide.low) + ' – ' + rub(p.guide.high)) : null);
}
