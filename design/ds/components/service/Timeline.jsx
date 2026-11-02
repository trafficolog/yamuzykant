import React from "react";
import { h, cx } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
/* Timeline */
export function Timeline(p) {
  return h('div', { className: 'ym-tlbox' }, h('ol', { className: cx('ym-tl', p.tone === 'service' ? 'ym-tl--service' : '', p.orientation === 'vertical' ? 'ym-tl--vertical' : '') },
    (p.steps || []).map(function (s, i) {
      var st = s.state || 'todo';
      return h('li', { key: i, className: 'ym-tl__step ym-tl__step--' + st, 'aria-current': st === 'current' ? 'step' : undefined },
        h('span', { className: 'ym-tl__bar' }),
        h('div', null, h('div', { className: 'ym-tl__label' }, st === 'done' ? h(Icon, { name: 'check', size: 14 }) : null, s.label,
          st === 'done' ? h('span', { className: 'ym-sr' }, ' — выполнено') : st === 'current' ? h('span', { className: 'ym-sr' }, ' — сейчас') : null),
          s.meta ? h('div', { className: 'ym-tl__meta' }, s.meta) : null));
    })));
}
