import type * as React from "react";
/**
 * Выпадающий список на нативном select в коробке Field: город, год выпуска, страна, сортировка — когда вариантов больше пяти.
 */
export interface SelectOption { value: string; label: string; disabled?: boolean }
export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label: string; options: (string | SelectOption)[]; placeholder?: string; hint?: string; error?: string;
  onChange?: (value: string) => void;
  /** Только для превью: hover / focus. */
  demo?: 'hover' | 'focus';
}
export declare function Select(props: SelectProps): JSX.Element;
