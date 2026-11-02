import React from "react";
import { h, initials } from "../core/shared.js";
import { Button } from "../actions/Button.jsx";
import { Badge } from "../display/Badge.jsx";
import { Rating } from "../display/Rating.jsx";
/* SellerCard */
export function SellerCard(p) {
  return h('section', { className: 'ym-panel', 'aria-label': 'Продавец' },
    h('div', { className: 'ym-seller__top' }, h('span', { className: 'ym-avatar' }, initials(p.name)),
      h('div', { style: { minWidth: 0 } }, h('p', { className: 'ym-seller__name' }, p.name),
        h('div', { className: 'ym-card__meta' }, h(Rating, { value: p.rating, count: p.reviews }), p.city ? h('span', null, '· ' + p.city) : null))),
    p.since ? h('div', { className: 'ym-card__meta' }, 'На ЯМузыканте с ' + p.since) : null,
    p.badges && p.badges.length ? h('div', { className: 'ym-badges' }, p.badges.map(function (b, i) { return h(Badge, { key: i, tone: b.tone, icon: b.icon }, b.label); })) : null,
    h('div', { className: 'ym-actions' }, h(Button, { variant: 'outline', size: 's', icon: 'message-circle' }, 'Написать'), h(Button, { variant: 'ghost', size: 's', iconRight: 'chevron-right' }, 'Все лоты')));
}
