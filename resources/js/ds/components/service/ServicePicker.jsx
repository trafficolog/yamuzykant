import React from "react";
import { h, useState, rub, initials, roving } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
import { Button } from "../actions/Button.jsx";
import { FilterChip } from "../forms/FilterChip.jsx";
import { Rating } from "../display/Rating.jsx";
import { Alert } from "../display/Alert.jsx";
import { plural } from "../commerce/OfferList.jsx";
/* ServicePicker — ремонт и обслуживание прямо из карточки: работа → место → мастер */
export function ServicePicker(p) {
  var st = useState(p.service || (p.services && p.services[0])); var svc = st[0];
  var geo = p.geo || 'prompt';
  var place;
  if (geo === 'granted') place = h('div', { className: 'ym-svc__place ym-svc__place--row' }, h(Icon, { name: 'map-pin', size: 16 }), h('span', { className: 'ym-svc__where' }, 'Рядом с вами: ', h('b', null, p.place)), h(Button, { variant: 'ghost', size: 'xs' }, 'Изменить'));
  else if (geo === 'loading') place = h('div', { className: 'ym-svc__place', role: 'status' }, h('span', { className: 'ym-spin', 'aria-hidden': 'true' }), 'Определяем, где вы…');
  else if (geo === 'denied') place = h('div', { className: 'ym-svc__place ym-svc__place--ask' }, h('span', null, 'Геопозиция выключена. Выберите город, и мы покажем мастеров в нём.'),
    h('div', { className: 'ym-field' }, h('label', { className: 'ym-field__label', htmlFor: (p.id || 'svc') + '-city' }, 'Город'),
      h('select', { id: (p.id || 'svc') + '-city', className: 'ym-svc__select', defaultValue: '', onChange: function (e) { if (p.onPickCity) p.onPickCity(e.target.value); } }, h('option', { value: '', disabled: true }, 'Выберите'), (p.cities || ['Москва', 'Санкт-Петербург', 'Екатеринбург', 'Казань', 'Новосибирск']).map(function (c) { return h('option', { key: c }, c); }))));
  else place = h('div', { className: 'ym-svc__place ym-svc__place--ask' }, h('span', null, 'Покажем мастеров рядом с вами. Геопозиция нужна только для расстояния, мы её не храним.'),
    h('div', { className: 'ym-actions' }, h(Button, { variant: 'outline', size: 's', icon: 'locate-fixed', onClick: p.onLocate }, 'Найти мастеров рядом'), h(Button, { variant: 'ghost', size: 's', onClick: function () { if (p.onPickCity) p.onPickCity(null); } }, 'Выбрать город')));
  var list = null;
  if (geo === 'loading') list = h('ul', { className: 'ym-svc__list', 'aria-hidden': 'true' }, [0, 1, 2].map(function (i) {
    return h('li', { key: i, className: 'ym-svc__row' }, h('span', { className: 'ym-skel ym-skel--avatar' }), h('span', { className: 'ym-svc__who' }, h('span', { className: 'ym-skel ym-skel--w60' }), h('span', { className: 'ym-skel ym-skel--w40' })), h('span', { className: 'ym-svc__buy' }, h('span', { className: 'ym-skel ym-skel--btn' })));
  }));
  if (geo === 'granted') {
    list = p.masters && p.masters.length ? h('ul', { className: 'ym-svc__list' }, p.masters.map(function (m, i) {
      return h('li', { key: i, className: 'ym-svc__row' },
        h('span', { className: 'ym-avatar ym-avatar--service ym-avatar--s' }, initials(m.name)),
        h('div', { className: 'ym-svc__who' }, h('span', { className: 'ym-offer__name' }, m.name),
          h('div', { className: 'ym-card__meta ym-card__meta--dots' }, h(Rating, { value: m.rating, count: m.reviews }), h('span', null, m.distance), m.slot ? h('span', null, 'окно ' + m.slot) : null)),
        h('div', { className: 'ym-svc__buy' }, h('span', { className: 'ym-svc__price' }, 'от ' + rub(m.priceFrom)), h(Button, { variant: 'service', size: 'xs', 'aria-label': 'Записаться к мастеру ' + m.name, onClick: function () { if (p.onBook) p.onBook(m, svc); } }, 'Записаться')));
    })) : h(Alert, { tone: 'service', title: 'Рядом нет мастеров по этой работе', action: 'Показать' }, (p.remote || 0) + ' ' + plural(p.remote || 0, ['мастер принимает', 'мастера принимают', 'мастеров принимают']) + ' инструмент через доставку с упаковкой.');
  }
  return h('section', { className: 'ym-svc', 'aria-label': 'Ремонт и обслуживание' },
    h('div', { className: 'ym-svc__head' }, h('h2', { className: 'ym-rail__t ym-title' }, h(Icon, { name: 'wrench', size: 20 }), 'Ремонт и обслуживание'), h('span', { className: 'ym-card__meta' }, 'Работы для раздела «' + p.category + '»')),
    h('div', { className: 'ym-rail__chips', role: 'radiogroup', 'aria-label': 'Работа', onKeyDown: roving }, (p.services || []).map(function (x) { return h(FilterChip, { key: x, radio: true, selected: x === svc, onChange: function () { st[1](x); if (p.onService) p.onService(x); } }, x); })),
    place, list);
}
