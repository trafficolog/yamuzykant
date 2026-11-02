import React from "react";
import { h, rub, initials } from "../core/shared.js";
import { Button } from "../actions/Button.jsx";
import { Badge } from "../display/Badge.jsx";
import { Rating } from "../display/Rating.jsx";
/* MasterCard */
export function MasterCard(p) {
  return h('article', { className: 'ym-panel' },
    h('div', { className: 'ym-seller__top' }, h('span', { className: 'ym-avatar ym-avatar--service' }, initials(p.name)),
      h('div', { style: { minWidth: 0 } }, h('p', { className: 'ym-seller__name' }, p.name),
        h('div', { className: 'ym-card__meta' }, p.workshop ? h('span', null, p.workshop) : null, h(Rating, { value: p.rating, count: p.reviews })))),
    h('div', { className: 'ym-master__specs' }, (p.specialties || []).map(function (s, i) { return h(Badge, { key: i, tone: 'service' }, s); }),
      p.verified ? h(Badge, { tone: 'accent', icon: 'badge-check' }, 'Документы проверены') : null),
    h('dl', { className: 'ym-facts' },
      h('div', null, h('dt', null, 'Стоимость'), h('dd', null, 'от ' + rub(p.priceFrom))),
      h('div', null, h('dt', null, 'Срок'), h('dd', null, p.eta)),
      h('div', null, h('dt', null, 'Где'), h('dd', null, p.distance || p.city))),
    h('div', { className: 'ym-actions' }, h(Button, { variant: 'service', size: 's', icon: 'wrench' }, 'Записаться'), h(Button, { variant: 'outline', size: 's' }, 'Спросить цену')));
}
