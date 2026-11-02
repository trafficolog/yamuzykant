import type * as React from "react";
import type { Condition } from "../core/Icon";
export interface Offer { href?: string; seller: string; partner?: boolean; condition: Condition; price: number; shipping?: number; eta?: string; city?: string; rating?: number; reviews?: number; inspected?: boolean }
/**
 * Все предложения по одной модели с вкладками «Все · Новые · Б/у»: продавец, метки, состояние, срок или город, цена с доставкой и действие.
 */
export interface OfferListProps { id?: string; offers: Offer[]; tab?: 'all' | 'new' | 'used'; onSubscribe?: () => void }
export declare function OfferList(props: OfferListProps): JSX.Element;
