import React from "react";
import { h, cx, omit } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
/* Select */
export function Select(p) {
  var id = p.id || 'ym-sel-' + String(p.label || 'x').length;
  var rest = omit(p, ['label', 'hint', 'error', 'options', 'placeholder', 'id', 'className', 'demo', 'onChange']);
  return h('div', { className: cx('ym-field', 'ym-select', p.error ? 'ym-field--error' : '', p.disabled ? 'ym-field--disabled' : '', p.className) },
    h('label', { className: 'ym-field__label', htmlFor: id }, p.label),
    h('div', { className: cx('ym-field__box', p.demo ? 'is-' + p.demo : '') },
      h('select', Object.assign({ id: id, 'aria-invalid': p.error ? 'true' : undefined, 'aria-describedby': id + '-hint', defaultValue: p.value === undefined && p.defaultValue === undefined && p.placeholder ? '' : undefined, onChange: p.onChange ? function (e) { p.onChange(e.target.value); } : undefined }, rest),
        p.placeholder ? h('option', { value: '', disabled: true }, p.placeholder) : null,
        p.options.map(function (o) { var opt = typeof o === 'string' ? { value: o, label: o } : o; return h('option', { key: opt.value, value: opt.value, disabled: opt.disabled }, opt.label); })),
      h('span', { className: 'ym-field__slot' }, p.error ? h(Icon, { name: 'circle-alert', size: 18 }) : h(Icon, { name: 'chevron-down', size: 18 }))),
    h('span', { className: 'ym-field__hint', id: id + '-hint', 'aria-live': 'polite' }, p.error || p.hint || ''));
}
