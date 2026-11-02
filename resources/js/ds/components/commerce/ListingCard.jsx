import React from "react";
import { h, useState, cx, nf, rub } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
import { Button } from "../actions/Button.jsx";
import { FavoriteButton } from "../actions/FavoriteButton.jsx";
import { Badge } from "../display/Badge.jsx";
import { CONDITIONS } from "../display/ConditionBadge.jsx";
import { plural } from "./OfferList.jsx";
/* ListingCard */
var GRADE = { 'mint': 5, 'excellent': 4, 'very-good': 3, 'good': 2, 'fair': 1, 'poor': 1, 'parts': 0 };
export function ConditionMeter(p) {
  var g = GRADE[p.condition]; if (g == null) g = 2;
  var c = CONDITIONS[p.condition] || CONDITIONS.good;
  var label = 'Состояние: ' + (p.condition === 'parts' ? c[0] : 'б/у, ' + c[0].replace('\u00ad', '').toLowerCase());
  var tone = p.condition === 'parts' ? 'danger' : p.condition === 'poor' ? 'warning' : '';
  return h('span', { className: cx('ym-cond', tone ? 'ym-cond--' + tone : ''), role: 'img', 'aria-label': label, title: label },
    [1, 2, 3, 4, 5].map(function (i) { return h('i', { key: i, className: i <= g ? 'is-on' : '' }); }));
}
export function ListingCard(p) {
  var media = p.image ? h('img', { src: p.image, alt: p.title, loading: 'lazy' })
    : h('span', { className: 'ym-placeholder' }, h(Icon, { name: p.icon || 'guitar', size: 40 }), 'Фото');
  var drop = p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  var st = useState(p.inCart || 0); var qty = p.onQty ? (p.inCart || 0) : st[0];
  function setQty(n) { if (p.onQty) p.onQty(n); else st[1](n); }
  var action = p.action || 'none';
  var cta = p.cta === false || action === 'none' ? null : action === 'buy'
    ? h(Button, { variant: 'primary', size: 's', block: true, onClick: p.onBuy }, p.ctaLabel || 'Купить')
    : qty > 0
    ? h('div', { className: 'ym-stepper', role: 'group', 'aria-label': 'Количество в корзине' },
        h('button', { type: 'button', 'aria-label': 'Убрать одну', onClick: function () { setQty(qty - 1); } }, h(Icon, { name: 'minus', size: 18 })),
        h('span', { 'aria-live': 'polite' }, qty, h('span', { className: 'ym-stepper__t' }, ' в корзине')),
        h('button', { type: 'button', 'aria-label': 'Добавить ещё', onClick: function () { setQty(qty + 1); } }, h(Icon, { name: 'plus', size: 18 })))
    : h(Button, { variant: 'primary', size: 's', block: true, onClick: function () { setQty(1); } }, p.ctaLabel || 'В корзину');
  var used = p.condition && p.condition !== 'new';
  var status = used ? h('div', { className: 'ym-card__status' }, h(ConditionMeter, { condition: p.condition }),
    p.safe !== false ? h('span', { className: 'ym-card__safe', role: 'img', 'aria-label': 'Безопасная сделка', title: 'Безопасная сделка' }, h(Icon, { name: 'shield-check', size: 16 })) : null) : null;
  var meta = [
    p.delivery ? h('span', { key: 'd', className: 'ym-card__del' }, p.delivery) : p.shipping === 0 ? h('span', { key: 'd', className: 'ym-card__del' }, 'Бесплатная доставка') : p.shipping != null ? h('span', { key: 'd' }, 'Доставка ' + rub(p.shipping)) : null,
    p.city ? h('span', { key: 'c' }, p.city + (p.distance ? ', ' + p.distance : '')) : null,
    p.posted ? h('span', { key: 'p' }, p.posted) : null].filter(Boolean);
  return h('article', { className: cx('ym-card', p.image ? 'ym-card--photo' : '') },
    h('a', { href: p.href || '#', className: 'ym-card__media', tabIndex: -1, 'aria-hidden': 'true' }, media),
    h('div', { className: 'ym-card__flags' }, [
      drop ? h(Badge, { key: 'd', tone: 'sale' }, '−' + drop + '%') : null,
      p.partner ? h(Badge, { key: 'p', icon: 'badge-check' }, 'Оригинал') : null,
      p.inspected ? h(Badge, { key: 'i', tone: 'service', icon: 'badge-check' }, 'Проверено мастером') : null,
      p.rare ? h(Badge, { key: 'r', tone: 'solid' }, 'Редкость') : null].filter(Boolean).slice(0, 2)),
    status,
    h('div', { className: 'ym-card__fav' }, h(FavoriteButton, { active: p.favorite })),
    h('div', { className: 'ym-card__body' },
      h('div', { className: 'ym-price' }, h('div', { className: 'ym-price__row' },
        h('span', { className: 'ym-price__now' }, drop ? h('span', { className: 'ym-sr' }, 'Цена со скидкой: ') : null, rub(p.price)),
        drop ? h('span', { className: 'ym-price__old' }, h('span', { className: 'ym-sr' }, 'Было: '), rub(p.oldPrice)) : null)),
      h('h3', { className: 'ym-card__title' }, h('a', { href: p.href || '#', className: 'ym-card__link' }, p.title)),
      p.rating ? h('div', { className: 'ym-card__rate' }, h(Icon, { name: 'star', size: 12 }), h('b', null, String(p.rating).replace('.', ',')), p.reviews ? h('span', { className: 'ym-card__rev' }, nf.format(p.reviews) + ' ' + plural(p.reviews, ['отзыв', 'отзыва', 'отзывов'])) : null) : null,
      meta.length ? h('div', { className: 'ym-card__meta' }, meta) : null,
      cta ? h('div', { className: 'ym-card__cta' }, cta) : null));
}
