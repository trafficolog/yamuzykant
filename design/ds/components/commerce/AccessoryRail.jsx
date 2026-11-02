import React from "react";
import { h, useState, roving } from "../core/shared.js";
import { Button } from "../actions/Button.jsx";
import { FilterChip } from "../forms/FilterChip.jsx";
import { AccessoryCard } from "./AccessoryCard.jsx";
export function AccessoryRail(p) {
  var groups = p.groups || [];
  var st = useState(0); var g = groups[st[0]] || { items: [] };
  return h('section', { className: 'ym-rail', 'aria-label': 'Аксессуары' },
    h('div', { className: 'ym-rail__head' }, h('h2', { className: 'ym-rail__t ym-title' }, p.title || 'Аксессуары'), h(Button, { variant: 'ghost', size: 's', iconRight: 'chevron-right' }, 'Все')),
    h('div', { className: 'ym-rail__chips', role: 'radiogroup', 'aria-label': 'Группа аксессуаров', onKeyDown: roving }, groups.map(function (x, i) { return h(FilterChip, { key: x.name, radio: true, selected: i === st[0], onChange: function () { st[1](i); } }, x.name); })),
    h('div', { className: 'ym-rail__row' }, g.items.map(function (it, i) { return h(AccessoryCard, Object.assign({ key: g.name + i }, it)); })));
}
