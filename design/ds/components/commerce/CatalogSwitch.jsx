import React from "react";
import { h, useState, nf } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
/* CatalogSwitch — Каталог (модели и новое у партнёров) / Барахолка (б/у лоты) */
export const VIEWS = [['catalog', 'Каталог', 'layout-grid', 'Модели, новое у партнёров'], ['flea', 'Барахолка', 'boxes', 'Б/у от частных продавцов']];
export function CatalogSwitch(p) {
  var st = useState(p.value || 'catalog'); var v = p.onChange ? (p.value || 'catalog') : st[0];
  return h('nav', { className: 'ym-switch', 'aria-label': 'Вид каталога' }, VIEWS.map(function (o) {
    var on = o[0] === v; var n = p.counts && p.counts[o[0]];
    return h('a', { key: o[0], href: (p.hrefs && p.hrefs[o[0]]) || '#', 'aria-current': on ? 'page' : undefined, className: 'ym-switch__opt', onClick: function (e) { if (!p.hrefs) { e.preventDefault(); if (p.onChange) p.onChange(o[0]); else st[1](o[0]); } } },
      h(Icon, { name: o[2], size: 18 }), h('span', { className: 'ym-switch__t' }, o[1], n != null ? h('span', { className: 'ym-switch__n' }, nf.format(n)) : null),
      h('span', { className: 'ym-switch__d' }, o[3]));
  }));
}
