import React from "react";
import { h, useState, roving } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
import { Button } from "../actions/Button.jsx";
import { Badge } from "../display/Badge.jsx";
import { ConditionBadge } from "../display/ConditionBadge.jsx";
import { PriceTag } from "../display/PriceTag.jsx";
import { Rating } from "../display/Rating.jsx";
export function plural(n, f) { var a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? f[2] : b > 1 && b < 5 ? f[1] : b === 1 ? f[0] : f[2]; }

/* OfferList — все предложения по модели: новые у партнёров и б/у лоты */
export function OfferList(p) {
  var offers = p.offers || [];
  var st = useState(p.tab || 'all'); var tab = st[0];
  var counts = { all: offers.length, 'new': offers.filter(function (o) { return o.condition === 'new'; }).length };
  counts.used = counts.all - counts['new'];
  var shown = offers.filter(function (o) { return tab === 'all' || (tab === 'new' ? o.condition === 'new' : o.condition !== 'new'); });
  var id = p.id || 'offers';
  var empty = { all: 'Пока нет ни одного предложения по этой модели.', 'new': 'Сейчас у партнёров нет этой модели в наличии.', used: 'На барахолке пока нет лотов этой модели.' };
  return h('section', { className: 'ym-offers', 'aria-label': 'Предложения' },
    h('div', { className: 'ym-offers__tabs', role: 'tablist', 'aria-label': 'Предложения по состоянию', onKeyDown: roving }, [['all', 'Все'], ['new', 'Новые'], ['used', 'Б/у']].map(function (t) {
      var on = tab === t[0];
      return h('button', { key: t[0], id: id + '-tab-' + t[0], type: 'button', role: 'tab', 'aria-selected': on ? 'true' : 'false', 'aria-controls': id + '-panel', tabIndex: on ? 0 : -1, className: 'ym-offers__tab', onClick: function () { st[1](t[0]); } }, t[1], h('span', { className: 'ym-chip__count' }, counts[t[0]]));
    })),
    h('div', { id: id + '-panel', role: 'tabpanel', 'aria-labelledby': id + '-tab-' + tab, tabIndex: 0, className: 'ym-offers__panel' },
    shown.length === 0 ? h('div', { className: 'ym-empty' }, h(Icon, { name: tab === 'used' ? 'boxes' : 'store', size: 28 }), h('p', { className: 'ym-empty__t' }, empty[tab]),
      h(Button, { variant: 'outline', size: 's', icon: 'bell', onClick: p.onSubscribe }, 'Сообщить о новых')) :
    h('ul', { className: 'ym-offers__list' }, shown.map(function (o, i) {
      return h('li', { key: i, className: 'ym-offer' },
        h('div', { className: 'ym-offer__who' },
          h('span', { className: 'ym-offer__name' }, o.seller),
          h('div', { className: 'ym-badges' }, o.partner ? h(Badge, { icon: 'store' }, 'Партнёр') : null, h(ConditionBadge, { condition: o.condition }), o.inspected ? h(Badge, { tone: 'service', icon: 'badge-check' }, 'Проверено') : null),
          h('div', { className: 'ym-card__meta ym-card__meta--dots' }, o.rating ? h(Rating, { value: o.rating, count: o.reviews }) : null, o.city ? h('span', null, o.city) : null, o.eta ? h('span', null, 'доставка ' + o.eta) : null)),
        h('div', { className: 'ym-offer__buy' }, h(PriceTag, { price: o.price, shipping: o.shipping }),
          h(Button, { variant: o.condition === 'new' ? 'primary' : 'outline', size: 's', href: o.href }, o.condition === 'new' ? 'Купить' : 'Смотреть лот')));
    }))));
}
