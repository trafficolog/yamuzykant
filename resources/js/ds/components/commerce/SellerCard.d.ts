import type * as React from "react";
import type { IconName, Tone } from "../core/Icon";
/**
 * Блок «О продавце» на странице лота: инициалы, имя, рейтинг, город, срок на площадке, метки и два действия.
 */
export interface SellerCardProps { name: string; rating: number; reviews?: number; city?: string; since?: string; badges?: { label: string; tone?: Tone; icon?: IconName }[] }
export declare function SellerCard(props: SellerCardProps): JSX.Element;
