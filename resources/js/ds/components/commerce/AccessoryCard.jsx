import React from "react";
import { h, useState, rub } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
import { Button } from "../actions/Button.jsx";
import { AccessoryRail } from "./AccessoryRail.jsx";
/* AccessoryCard и AccessoryRail — аксессуары к модели */
export function AccessoryCard(p) {
  var st = useState(!!p.inCart); var added = p.onAdd ? !!p.inCart : st[0];
  return h('article', { className: 'ym-acc' },
    h('a', { href: p.href || '#', className: 'ym-acc__media', tabIndex: -1, 'aria-hidden': 'true' }, p.image ? h('img', { src: p.image, alt: '' }) : h(Icon, { name: p.icon || 'package', size: 28 })),
    h('div', { className: 'ym-acc__body' },
      h('a', { href: p.href || '#', className: 'ym-acc__title ym-card__link' }, p.title),
      p.fit ? h('span', { className: 'ym-acc__fit ym-acc__fit--' + p.fit }, h(Icon, { name: p.fit === 'fits' ? 'circle-check' : 'triangle-alert', size: 14 }), p.fit === 'fits' ? 'Подходит' : 'Уточните') : null,
      h('div', { className: 'ym-acc__foot' }, h('span', { className: 'ym-price__now' }, rub(p.price)),
        h(Button, { variant: added ? 'muted' : 'primary', size: 'xs', icon: added ? 'check' : 'shopping-bag', loading: p.adding, 'aria-pressed': added ? 'true' : 'false', onClick: function () { if (p.onAdd) p.onAdd(!added); else st[1](!added); } }, p.adding ? 'Добавляем' : added ? 'В корзине' : 'В корзину')),
      p.error ? h('span', { className: 'ym-acc__err', role: 'alert' }, h(Icon, { name: 'circle-alert', size: 14 }), p.error) : null));
}
