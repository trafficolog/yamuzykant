import type * as React from "react";
import type { IconName, Tone } from "../core/Icon";
/**
 * Плоская метка 24 px с радиусом radius-xs : одно-три слова статуса или свойства рядом с лотом, заказом или мастером.
 */
export interface BadgeProps { tone?: Tone; icon?: IconName; children?: React.ReactNode }
export declare function Badge(props: BadgeProps): JSX.Element;
