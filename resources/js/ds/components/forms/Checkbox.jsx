import React from "react";
import { h, cx, omit } from "../core/shared.js";
import { Icon } from "../core/Icon.jsx";
/* Checkbox */
export function Checkbox(p) {
  var id = p.id || 'ym-cb-' + String(p.label || 'x').length;
  var rest = omit(p, ['label', 'hint', 'error', 'indeterminate', 'id', 'className', 'demo', 'onChange']);
  var ref = React.useRef(null);
  React.useEffect(function () { if (ref.current) ref.current.indeterminate = !!p.indeterminate; }, [p.indeterminate]);
  return h('div', { className: cx('ym-check', p.error ? 'ym-check--error' : '', p.disabled ? 'ym-check--disabled' : '', p.demo ? 'demo-' + p.demo : '', p.className) },
    h('label', { className: 'ym-check__row', htmlFor: id },
      h('input', Object.assign({ ref: ref, type: 'checkbox', id: id, className: 'ym-check__input', 'aria-invalid': p.error ? 'true' : undefined, 'aria-describedby': (p.hint || p.error) ? id + '-hint' : undefined, onChange: p.onChange ? function (e) { p.onChange(e.target.checked); } : undefined }, rest)),
      h('span', { className: 'ym-check__box', 'aria-hidden': 'true' }, h(Icon, { name: 'check', size: 14 }), h(Icon, { name: 'minus', size: 14 })),
      h('span', { className: 'ym-check__label' }, p.label)),
    (p.hint || p.error) ? h('span', { className: 'ym-check__hint', id: id + '-hint' }, p.error || p.hint) : null);
}
