import React from "react";
import { h } from "../core/shared.js";
import { Icon } from "./Icon.jsx";
import { Wordmark } from "./Wordmark.jsx";
import { Button } from "../actions/Button.jsx";
import { IconButton } from "../actions/IconButton.jsx";
import { SearchBar } from "../forms/SearchBar.jsx";
/* Header */
export const DIRS = [['catalog', 'Каталог', 'layout-grid'], ['flea', 'Барахолка', 'boxes'], ['parts', 'Аксессуары', 'cable'], ['masters', 'Мастера', 'wrench'], ['guide', 'Цены на б/у', 'sliders-horizontal']];
export const CATS = ['Гитары', 'Педали и усилители', 'Клавишные и синтезаторы', 'Студия и запись', 'Ударные', 'Духовые', 'DJ', 'Всё'];
export function Header(p) {
  var active = p.active || 'catalog';
  return h('header', { className: 'ym-header' },
    h('div', { className: 'ym-header__top' }, h(Wordmark, { size: 24, href: '#' }),
      h(Button, { variant: 'primary', icon: 'menu', className: 'ym-header__catalog', 'aria-label': 'Каталог' }, h('span', { className: 'ym-header__catlabel' }, 'Каталог')),
      h(SearchBar, { id: 'ym-header-search' }),
      h('div', { className: 'ym-header__icons' },
        h(IconButton, { icon: 'user', label: 'Войти' }), h('span', { className: 'ym-header__orders' }, h(IconButton, { icon: 'package', label: 'Заказы' })),
        h(IconButton, { icon: 'heart', label: 'Избранное' }), h(IconButton, { icon: 'shopping-bag', label: 'Корзина', count: p.cart }))),
    h('nav', { className: 'ym-header__nav', 'aria-label': 'Разделы' },
      DIRS.map(function (d) { return h('a', { key: d[0], href: '#', className: 'ym-header__dir', 'aria-current': d[0] === active ? 'page' : undefined }, h(Icon, { name: d[2], size: 16 }), d[1]); }),
      h('span', { className: 'ym-header__sep', 'aria-hidden': 'true' }),
      CATS.map(function (c) { return h('a', { key: c, href: '#', className: 'ym-header__cat' }, c); }),
      h('a', { href: '#', className: 'ym-header__sell' }, h(Icon, { name: 'tag', size: 16 }), 'Продать инструмент')));
}
