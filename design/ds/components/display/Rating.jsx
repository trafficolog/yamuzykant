import React from "react";
import { h, nf } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
export function Rating(p) {
  return h('span', { className: 'ym-rating' }, h(Icon, { name: 'star', size: 16 }), String(p.value).replace('.', ','),
    p.count != null ? h('span', { className: 'ym-muted ym-rating__n' }, '(' + nf.format(p.count) + ')') : null);
}
