import React from "react";
import { h } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
import { Button } from "../actions/Button.jsx";
/* Alert */
export const AL = { info: 'info', success: 'circle-check', warning: 'triangle-alert', danger: 'circle-alert', service: 'wrench' };
export function Alert(p) {
  var tone = p.tone || 'info';
  return h('div', { className: 'ym-alert ym-alert--' + tone, role: tone === 'danger' ? 'alert' : 'status' }, h(Icon, { name: p.icon || AL[tone], size: 20 }),
    h('div', { className: 'ym-alert__body' }, p.title ? h('p', { className: 'ym-alert__t' }, p.title) : null, p.children ? h('p', { className: 'ym-alert__d' }, p.children) : null),
    p.action ? h(Button, { variant: 'outline', size: 'xs' }, p.action) : null);
}
