import type * as React from "react";
/**
 * Переключатель вида каталога в каждом разделе инструментов: «Каталог» — модели и новое у партнёров, «Барахолка» — лента б/у лотов от частных продавцов.
 */
export interface CatalogSwitchProps { value?: 'catalog' | 'flea'; counts?: { catalog?: number; flea?: number };
  /** Адреса двух видов. Каталог и Барахолка — разные страницы, поэтому это ссылки с aria-current="page". */
  hrefs?: { catalog: string; flea: string };
  /** Только для превью без адресов. */
  onChange?: (v: 'catalog' | 'flea') => void }
export declare function CatalogSwitch(props: CatalogSwitchProps): JSX.Element;
