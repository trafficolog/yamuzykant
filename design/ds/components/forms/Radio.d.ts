import type * as React from "react";
/**
 * Группа радиокнопок: один вариант из 2–5 видимых — способ доставки, состояние, тип продавца. Больше пяти — Select.
 */
export interface RadioOption { value: string; label: React.ReactNode; hint?: string; disabled?: boolean }
export interface RadioProps {
  name?: string; label?: string; options: (string | RadioOption)[];
  value?: string; defaultValue?: string; onChange?: (value: string) => void;
  /** В строку вместо столбца — для 2–3 коротких вариантов. */
  inline?: boolean; disabled?: boolean; error?: string; className?: string;
  /** Только для превью: hover / focus на первом варианте. */
  demo?: 'hover' | 'focus';
}
export declare function Radio(props: RadioProps): JSX.Element;
