import type * as React from "react";
/**
 * Главный поиск: таблетка control-m с рамкой line-control и круглой тёмной кнопкой «Найти».
 */
export interface SearchBarProps { id?: string; scope?: string; placeholder?: string; defaultValue?: string; onSearch?: (query: string) => void }
export declare function SearchBar(props: SearchBarProps): JSX.Element;
