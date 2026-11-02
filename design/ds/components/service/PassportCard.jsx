import React from "react";
import { h } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
import { Badge } from "../display/Badge.jsx";
/* PassportCard — Паспорт инструмента */
export const EV = { inspection: 'badge-check', repair: 'wrench', sale: 'handshake', setup: 'sliders-horizontal' };
export const EVN = { inspection: 'Проверка', repair: 'Ремонт', sale: 'Сделка', setup: 'Настройка' };
export function PassportCard(p) {
  return h('section', { className: 'ym-panel', 'aria-label': 'Паспорт инструмента' },
    h('div', { className: 'ym-pass__head' },
      h('div', { style: { minWidth: 0 } }, h('div', { className: 'ym-card__meta' }, h(Icon, { name: 'history', size: 16 }), 'Паспорт инструмента'),
        h('p', { className: 'ym-pass__name' }, p.instrument)),
      p.verified ? h(Badge, { tone: 'service', icon: 'badge-check' }, 'S/N сверен мастером') : null),
    h('div', { className: 'ym-pass__ids' }, h('span', { className: 'ym-mono' }, 'S/N ' + p.serial), p.year ? h('span', { className: 'ym-mono' }, p.year) : null, p.owners ? h('span', { className: 'ym-mono' }, 'Владельцев: ' + p.owners) : null),
    h('ul', { className: 'ym-pass__ev' }, (p.events || []).map(function (e, i) {
      return h('li', { key: i }, h('span', { className: 'ym-pass__date' }, e.date),
        h('span', { className: 'ym-pass__k ym-pass__k--' + e.kind, title: EVN[e.kind] }, h(Icon, { name: EV[e.kind] || 'history', size: 16, label: EVN[e.kind] })),
        h('div', null, h('div', { className: 'ym-pass__txt' }, e.text), e.by ? h('div', { className: 'ym-pass__by' }, e.by) : null));
    })));
}
