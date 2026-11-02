import type * as React from "react";
/**
 * Поле ввода с подписью сверху и подсказкой снизу; высота control-m , радиус radius-sm , рамка line-control толщиной 1 px во всех состояниях.
 */
export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string; hint?: string; error?: string; suffix?: string;
  /** Значение проверено: зелёная рамка и галочка в правом слоте. */
  success?: boolean;
  /** Идёт проверка: спиннер в правом слоте, поле остаётся редактируемым. */
  loading?: boolean;
  /** Только для превью. */
  demo?: 'focus';
}
export declare function Field(props: FieldProps): JSX.Element;
