import React from "react";
import { ICONS, h, cx } from "../core/shared.js";
export function Icon(p) {
  var size = p.size || 20;
  var a = { className: cx('ym-icon', p.className), width: size, height: size, viewBox: '0 0 24 24', dangerouslySetInnerHTML: { __html: ICONS[p.name] || '' } };
  if (p.label) { a.role = 'img'; a['aria-label'] = p.label; } else { a['aria-hidden'] = 'true'; }
  return h('svg', a);
}
