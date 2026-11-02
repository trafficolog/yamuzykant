import React from "react";
import { h } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
/* TrustStrip */
export const TRUST = [
  { icon: 'shield-check', tone: 'accent', title: 'Безопасная сделка: деньги у нас, пока вы не проверите инструмент', text: 'Продавец получает оплату только после вашего подтверждения. Если инструмент не совпал с описанием, деньги возвращаются.' },
  { icon: 'wrench', tone: 'service', title: 'Проверка мастером', text: 'Мастер смотрит лот до отправки и пишет отчёт.' },
  { icon: 'truck', tone: 'parts', title: 'Доставка с упаковкой', text: 'Упаковка для гитар и усилителей, страховка на сумму сделки.' },
  { icon: 'message-circle', tone: 'guide', title: 'Поддержка людьми', text: 'Спор решают сотрудники, а не бот.' }
];
export function TrustStrip(p) {
  var items = p.items || TRUST; var lead = items[0], rest = items.slice(1);
  return h('section', { className: 'ym-trust', 'aria-label': 'Гарантии ЯМузыканта' },
    h('div', { className: 'ym-trust__grid' },
      h('div', { className: 'ym-trust__lead' }, h('h2', { className: 'ym-trust__lead-t' }, h(Icon, { name: lead.icon, size: 24 }), lead.title), h('p', { className: 'ym-trust__lead-d' }, lead.text)),
      h('ul', { className: 'ym-trust__list' }, rest.map(function (it, i) {
        return h('li', { className: 'ym-trust__item', key: i },
          h('p', { className: 'ym-trust__t ym-trust__t--' + (it.tone || 'accent') }, h(Icon, { name: it.icon, size: 18 }), it.title), h('p', { className: 'ym-trust__d' }, it.text));
      }))));
}
