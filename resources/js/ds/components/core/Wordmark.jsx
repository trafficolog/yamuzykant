import React from "react";
import { h, cx } from "../core/shared.js";
/* Wordmark — логотипа пока нет, это набор шрифтом */
export function Wordmark(p) {
  var size = p.size || 24;
  return h(p.href ? 'a' : 'span', { className: cx('ym-wordmark', p.mono ? 'ym-wordmark--mono' : ''), href: p.href, style: { fontSize: size + 'px' }, 'aria-label': 'ЯМузыкант' }, 'ЯМузыкант', h('i', { 'aria-hidden': 'true' }));
}
