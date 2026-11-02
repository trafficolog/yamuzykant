import React from "react";
import { h, rub } from "../core/shared.js";
import { Button } from "../actions/Button.jsx";
import { Badge } from "../display/Badge.jsx";
import { Timeline } from "./Timeline.jsx";
/* RepairOrderCard */
export function RepairOrderCard(p) {
  return h('article', { className: 'ym-panel' },
    h('div', { className: 'ym-order__head' },
      h('div', { style: { minWidth: 0 } }, h('div', { className: 'ym-mono ym-muted' }, p.number), h('p', { className: 'ym-order__title' }, p.instrument),
        p.work ? h('div', { className: 'ym-card__meta' }, p.work) : null),
      h(Badge, { tone: p.statusTone || 'service' }, p.status)),
    h(Timeline, { tone: 'service', steps: p.steps }),
    h('div', { className: 'ym-order__foot' },
      h('div', { className: 'ym-card__meta' }, h(Badge, { tone: 'accent', icon: 'shield-check' }, 'На безопасной сделке ' + rub(p.amount)), p.master ? h('span', null, 'Мастер: ' + p.master) : null),
      p.action ? h(Button, { variant: 'outline', size: 's', icon: 'message-circle' }, p.action) : null));
}
