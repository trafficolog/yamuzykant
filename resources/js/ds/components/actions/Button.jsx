import React from "react";
import { h, cx, omit } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
/* Button */
export function Button(p) {
  var cls = cx('ym-btn', 'ym-btn--' + (p.variant || 'primary'), p.size && p.size !== 'm' ? 'ym-btn--' + p.size : '', p.block ? 'ym-btn--block' : '', p.demo ? 'is-' + p.demo : '', p.className);
  var rest = omit(p, ['variant', 'size', 'block', 'icon', 'iconRight', 'children', 'className', 'loading', 'demo']);
  var isz = p.size === 'xs' || p.size === 's' ? 16 : 20;
  var lead = p.loading ? h('span', { className: 'ym-spin', 'aria-hidden': 'true', style: { fontSize: isz + 'px' } }) : p.icon ? h(Icon, { name: p.icon, size: isz }) : null;
  var a = Object.assign({ type: p.href ? undefined : (p.type || 'button') }, rest, { className: cls });
  if (p.loading) { a['aria-busy'] = 'true'; a['aria-disabled'] = 'true'; a.onClick = function (e) { e.preventDefault(); }; }
  return h(p.href ? 'a' : 'button', a, lead, p.children, p.iconRight && !p.loading ? h(Icon, { name: p.iconRight, size: isz }) : null);
}
