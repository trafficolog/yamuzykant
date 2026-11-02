import type * as React from "react";
/**
 * Флажок 20 px: независимый выбор — фильтры выдачи, согласие с условиями, «Показывать только с безопасной сделкой». Подпись справа, кликабельна целиком.
 */
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: React.ReactNode; hint?: string; error?: string;
  /** Частичный выбор: «выбраны не все» в группе фильтров. */
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  /** Только для превью: принудительно показать hover / focus. */
  demo?: 'hover' | 'focus';
}
export declare function Checkbox(props: CheckboxProps): JSX.Element;
