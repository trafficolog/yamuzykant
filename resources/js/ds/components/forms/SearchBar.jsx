import React from "react";
import { h } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
/* SearchBar */
export function SearchBar(p) {
  var id = p.id || 'ym-search';
  return h('form', { className: 'ym-search', role: 'search', onSubmit: function (e) { e.preventDefault(); if (p.onSearch) p.onSearch(e.target.elements[id].value); } },
    p.scope ? h('span', { className: 'ym-search__scope' }, p.scope) : null,
    h('label', { className: 'ym-sr', htmlFor: id }, 'Поиск'),
    h('input', { id: id, name: id, type: 'search', placeholder: p.placeholder || 'Гитары, синтезаторы, педали, мастера', defaultValue: p.defaultValue }),
    h('button', { type: 'submit', className: 'ym-search__go', 'aria-label': 'Найти' }, h(Icon, { name: 'search', size: 18 }), h('span', null, 'Найти')));
}
