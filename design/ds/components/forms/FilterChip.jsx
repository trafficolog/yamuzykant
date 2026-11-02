import React from "react";
import { h, useState, nf } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
/* FilterChip */
export function FilterChip(p) {
  var st = useState(!!p.selected); var on = p.onChange ? !!p.selected : st[0];
  var a = { type: 'button', className: 'ym-chip', disabled: p.disabled, onClick: function () { if (p.radio) { if (!on) { if (p.onChange) p.onChange(true); else st[1](true); } } else if (p.onChange) p.onChange(!on); else st[1](!on); } };
  if (p.radio) { a.role = 'radio'; a['aria-checked'] = on ? 'true' : 'false'; a.tabIndex = on ? 0 : -1; } else { a['aria-pressed'] = on ? 'true' : 'false'; }
  return h('button', a,
    p.icon ? h(Icon, { name: p.icon, size: 16 }) : null, p.children,
    p.count != null ? h('span', { className: 'ym-chip__count' }, nf.format(p.count)) : null,
    on && p.removable ? h(Icon, { name: 'x', size: 14 }) : null);
}
