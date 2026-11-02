import React from "react";
import { h } from "../core/shared.js";
import { Badge } from "./Badge.jsx";
/* ConditionBadge */
export const CONDITIONS = {
  'new': ['Новое', 'accent'], 'mint': ['Как новое', ''], 'excellent': ['Отличное', ''], 'very-good': ['Очень хорошее', ''],
  'good': ['Хорошее', ''], 'fair': ['Удовлетвори\u00adтельное', ''], 'poor': ['Плохое', 'warning'], 'parts': ['На запчасти', 'danger']
};
export function ConditionBadge(p) {
  var c = CONDITIONS[p.condition] || CONDITIONS.good;
  var text = p.condition === 'new' || p.condition === 'parts' ? c[0] : 'Б/у · ' + c[0];
  return h(Badge, { tone: c[1] || 'neutral' }, text);
}
