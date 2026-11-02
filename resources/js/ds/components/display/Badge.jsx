import React from "react";
import { h, cx } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
/* Badge */
export function Badge(p) {
  return h('span', { className: cx('ym-badge', p.tone && p.tone !== 'neutral' ? 'ym-badge--' + p.tone : '', p.className) }, p.icon ? h(Icon, { name: p.icon, size: 14 }) : null, h('span', { className: 'ym-badge__t' }, p.children));
}
