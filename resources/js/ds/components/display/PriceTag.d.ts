import type * as React from "react";
/**
 * Цена в рублях с неразрывным пробелом и знаком ₽ после числа; при снижении — старая цена зачёркнута, процент в danger .
 */
export interface PriceTagProps { price: number; oldPrice?: number; shipping?: number; size?: 'card' | 'pdp' }
export declare function PriceTag(props: PriceTagProps): JSX.Element;
