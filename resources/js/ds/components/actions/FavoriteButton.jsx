import React from "react";
import { h, useState, cx } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
/* FavoriteButton */
export function FavoriteButton(p) {
  var st = useState(!!p.active); var on = p.onToggle ? !!p.active : st[0];
  function toggle(e) { e.preventDefault(); e.stopPropagation(); if (p.onToggle) p.onToggle(!on); else st[1](!on); }
  var count = p.count != null ? p.count + (on && !p.onToggle && !p.active ? 1 : 0) : null;
  return h('button', { type: 'button', className: cx('ym-fav', p.count != null ? 'ym-fav--count' : '', p.className), 'aria-pressed': on ? 'true' : 'false', 'aria-label': on ? 'Убрать из избранного' : 'В избранное', onClick: toggle },
    h(Icon, { name: 'heart', size: 20 }), count != null ? h('span', { className: 'ym-num' }, count) : null);
}
