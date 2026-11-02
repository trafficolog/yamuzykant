import React from "react";
import { h } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
/* IconButton — иконка с подписью в шапке */
export function IconButton(p) {
  return h(p.href ? 'a' : 'button', { className: 'ym-iconbtn', href: p.href, type: p.href ? undefined : 'button', 'aria-label': p.count ? p.label + ', ' + p.count : p.label, onClick: p.onClick },
    h(Icon, { name: p.icon, size: 22 }), p.showLabel === false ? null : h('span', null, p.label),
    p.count ? h('span', { className: 'ym-iconbtn__count', 'aria-hidden': 'true' }, p.count) : null);
}
