import React from "react";
import { h, cx } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
/* FitmentBadge */
export const FIT = { fits: ['circle-check', 'Подходит к '], check: ['triangle-alert', 'Уточните совместимость с '], no: ['x', 'Не подходит к '] };
export function FitmentBadge(p) {
  var f = FIT[p.status || 'fits'];
  return h('span', { className: cx('ym-fit', p.status && p.status !== 'fits' ? 'ym-fit--' + p.status : '') }, h(Icon, { name: f[0], size: 18 }), h('span', null, f[1], h('b', null, p.target)));
}
