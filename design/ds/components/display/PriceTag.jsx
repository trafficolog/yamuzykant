import React from "react";
import { h, cx, rub } from "../core/shared.js";
import { Badge } from "./Badge.jsx";
/* PriceTag */
export function PriceTag(p) {
  var drop = p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  var ship = p.shipping === 0 ? h('span', { className: 'ym-price__ship ym-price__ship--free' }, 'Бесплатная доставка')
    : p.shipping != null ? h('span', { className: 'ym-price__ship' }, '+ ' + rub(p.shipping) + ' доставка') : null;
  return h('div', { className: cx('ym-price', p.size === 'pdp' ? 'ym-price--pdp' : '') },
    h('div', { className: 'ym-price__row' },
      h('span', { className: 'ym-price__now' }, drop ? h('span', { className: 'ym-sr' }, 'Новая цена: ') : null, rub(p.price)),
      drop ? h('span', { className: 'ym-price__old' }, h('span', { className: 'ym-sr' }, 'Было: '), rub(p.oldPrice)) : null,
      drop ? h(Badge, { tone: 'sale', className: 'ym-price__drop' }, h('span', { className: 'ym-sr' }, 'Скидка '), '−' + drop + '%') : null),
    ship);
}
