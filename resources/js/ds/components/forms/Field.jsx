import React from "react";
import { h, cx, omit } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
/* Field */
export function Field(p) {
  var id = p.id || 'ym-field-' + String(p.label || 'x').length;
  var rest = omit(p, ['label', 'hint', 'error', 'success', 'loading', 'suffix', 'id', 'className', 'demo']);
  var state = p.error ? 'error' : p.success ? 'success' : '';
  var slot = p.loading ? h('span', { className: 'ym-spin', 'aria-hidden': 'true' }) : p.error ? h(Icon, { name: 'circle-alert', size: 18 }) : p.success ? h(Icon, { name: 'check', size: 18 }) : null;
  return h('div', { className: cx('ym-field', state ? 'ym-field--' + state : '', p.disabled ? 'ym-field--disabled' : '', p.className) },
    h('label', { className: 'ym-field__label', htmlFor: id }, p.label),
    h('div', { className: cx('ym-field__box', p.demo ? 'is-' + p.demo : '') }, h('input', Object.assign({ id: id, 'aria-invalid': p.error ? 'true' : undefined, 'aria-busy': p.loading ? 'true' : undefined, 'aria-describedby': id + '-hint' }, rest)),
      p.suffix ? h('span', { className: 'ym-field__suffix' }, p.suffix) : null,
      h('span', { className: 'ym-field__slot' }, slot)),
    h('span', { className: 'ym-field__hint', id: id + '-hint', 'aria-live': 'polite' }, p.error || p.hint || ''));
}
