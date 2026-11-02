import React from "react";
import { h, cx, omit } from "../core/shared.js";
/* Textarea */
export function Textarea(p) {
  var id = p.id || 'ym-ta-' + String(p.label || 'x').length;
  var rest = omit(p, ['label', 'hint', 'error', 'id', 'className', 'demo', 'maxLength', 'onChange', 'value', 'defaultValue']);
  var st = React.useState(p.defaultValue || ''); var val = p.value !== undefined ? p.value : st[0];
  function ch(e) { if (p.value === undefined) st[1](e.target.value); if (p.onChange) p.onChange(e.target.value); }
  var over = p.maxLength && val.length > p.maxLength;
  return h('div', { className: cx('ym-field', 'ym-textarea', (p.error || over) ? 'ym-field--error' : '', p.disabled ? 'ym-field--disabled' : '', p.className) },
    h('label', { className: 'ym-field__label', htmlFor: id }, p.label),
    h('div', { className: cx('ym-field__box', p.demo ? 'is-' + p.demo : '') },
      h('textarea', Object.assign({ id: id, value: val, onChange: ch, rows: p.rows || 4, 'aria-invalid': (p.error || over) ? 'true' : undefined, 'aria-describedby': id + '-hint' }, rest))),
    h('span', { className: 'ym-textarea__foot' },
      h('span', { className: 'ym-field__hint', id: id + '-hint', 'aria-live': 'polite' }, p.error || (over ? 'Слишком длинно — сократите текст' : p.hint) || ''),
      p.maxLength ? h('span', { className: 'ym-textarea__count ym-num' }, val.length + ' / ' + p.maxLength) : null));
}
