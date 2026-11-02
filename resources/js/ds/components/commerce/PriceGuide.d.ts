import type * as React from "react";
/**
 * Модуль «Ля440» — справочник цен: диапазон реальных продаж латунной полосой guide и маркер цены лота ink .
 */
export interface PriceGuideProps { low: number; high: number; price?: number; basis?: string }
export declare function PriceGuide(props: PriceGuideProps): JSX.Element;
