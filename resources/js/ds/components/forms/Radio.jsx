import React from "react";
import { h, cx } from "../core/shared.js";
/* Radio */
export function Radio(p) {
  var st = React.useState(p.defaultValue); var value = p.value !== undefined ? p.value : st[0];
  var name = p.name || 'ym-radio-' + String(p.label || 'x').length;
  function pick(v) { if (p.value === undefined) st[1](v); if (p.onChange) p.onChange(v); }
  return h('fieldset', { className: cx('ym-radio', p.error ? 'ym-radio--error' : '', p.inline ? 'ym-radio--inline' : '', p.className), disabled: p.disabled },
    p.label ? h('legend', { className: 'ym-radio__legend' }, p.label) : null,
    h('div', { className: 'ym-radio__list' }, p.options.map(function (o, i) {
      var opt = typeof o === 'string' ? { value: o, label: o } : o; var id = name + '-' + i;
      return h('label', { key: opt.value, htmlFor: id, className: cx('ym-radio__item', opt.disabled ? 'is-disabled' : '') },
        h('input', { type: 'radio', id: id, name: name, value: opt.value, checked: value === opt.value, disabled: opt.disabled, onChange: function () { pick(opt.value); } }),
        h('span', { className: cx('ym-radio__dot', p.demo && i === 0 ? 'demo-' + p.demo : ''), 'aria-hidden': 'true' }),
        h('span', { className: 'ym-radio__text' }, h('span', null, opt.label), opt.hint ? h('span', { className: 'ym-radio__hint' }, opt.hint) : null));
    })),
    p.error ? h('span', { className: 'ym-radio__err' }, p.error) : null);
}
