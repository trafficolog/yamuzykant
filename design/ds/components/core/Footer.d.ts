import type * as React from "react";
/**
 * Подвал сайта, светлый: полоса сервисов экосистемы → 4 колонки ссылок + «Поддержка» → нижняя строка с логотипом, копирайтом и юридическими ссылками.
 * Структура как у крупных площадок объявлений; стиль — токены ЯМузыканта. `compact` — только нижняя строка (оформление, кабинет мастера).
 */
export interface FooterProps {
  /** full (по умолчанию) или compact — только нижняя строка */
  variant?: "full" | "compact";
  /** [подпись, иконка] — полоса сервисов */
  services?: [string, string][];
  /** [заголовок, ссылки[]] — до 4 колонок */
  columns?: [string, string[]][];
  legal?: string[];
  /** Текстовые ссылки на соцсети; [] — скрыть */
  social?: string[];
  hours?: string;
  /** false — скрыть e-mail */
  email?: string | false;
  copyright?: string;
}
export declare function Footer(props: FooterProps): React.ReactElement;
