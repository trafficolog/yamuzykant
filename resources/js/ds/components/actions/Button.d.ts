import type * as React from "react";
import type { IconName } from "../core/Icon";
/**
 * Кнопка-таблетка на всю высоту контрола; primary (цвет accent ) — одна на экран, для действия, ради которого экран существует.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'inverse' | 'outline' | 'muted' | 'ghost' | 'service' | 'danger';
  size?: 'xs' | 's' | 'm' | 'l';
  block?: boolean; icon?: IconName; iconRight?: IconName; href?: string;
  /** Показывает спиннер вместо иконки, ставит aria-busy и блокирует повторное нажатие; подпись остаётся. */
  loading?: boolean;
  /** Только для превью: принудительно показать состояние hover / focus / active. */
  demo?: 'hover' | 'focus' | 'active';
}
export declare function Button(props: ButtonProps): JSX.Element;
