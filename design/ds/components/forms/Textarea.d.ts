import type * as React from "react";
/**
 * Многострочное поле: описание объявления, «Опишите, что случилось с инструментом», сообщение продавцу. Счётчик символов по maxLength.
 */
export interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label: string; hint?: string; error?: string; rows?: number;
  /** Мягкий лимит: счётчик внизу справа, превышение — состояние ошибки, ввод не блокируется. */
  maxLength?: number;
  onChange?: (value: string) => void;
  /** Только для превью: hover / focus. */
  demo?: 'hover' | 'focus';
}
export declare function Textarea(props: TextareaProps): JSX.Element;
