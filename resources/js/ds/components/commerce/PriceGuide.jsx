import React from "react";
import { h, nf, rub } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
/* PriceGuide — справочник «Цены на б/у» */
export function PriceGuide(p) {
  var lo = p.low, hi = p.high, pr = p.price;
  var min = Math.min(lo, pr == null ? lo : pr) * 0.85, max = Math.max(hi, pr == null ? hi : pr) * 1.1;
  function pos(v) { return ((v - min) / (max - min) * 100).toFixed(2) + '%'; }
  var verdict = pr == null ? null : pr < lo ? ['Ниже диапазона: проверьте состояние и продавца', 'triangle-alert'] : pr > hi ? ['Выше обычной цены на б/у', 'circle-alert'] : ['Обычная цена для б/у', 'circle-check'];
  return h('section', { className: 'ym-guide', 'aria-label': 'Справочник цен на б/у' },
    h('div', { className: 'ym-guide__head' }, h('span', { className: 'ym-guide__name' }, 'Цены на б/у'), h('span', { className: 'ym-guide__basis' }, p.basis || 'по продажам за 12 месяцев')),
    h('div', { className: 'ym-guide__range' }, nf.format(lo) + ' – ' + rub(hi)),
    h('div', { className: 'ym-guide__track', role: 'img', 'aria-label': 'Диапазон ' + rub(lo) + ' – ' + rub(hi) + (pr != null ? ', цена лота ' + rub(pr) : '') },
      h('span', { className: 'ym-guide__band', style: { left: pos(lo), width: 'calc(' + pos(hi) + ' - ' + pos(lo) + ')' } }),
      pr != null ? h('span', { className: 'ym-guide__marker', style: { left: pos(pr) } }) : null),
    verdict ? h('div', { className: 'ym-guide__verdict' }, h(Icon, { name: verdict[1], size: 18 }), verdict[0] + (pr != null ? ' · ' + rub(pr) : '')) : null);
}
