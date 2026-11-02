import type * as React from "react";
import type { IconName } from "../core/Icon";
export interface TrustItem { icon: IconName; tone?: 'accent' | 'service' | 'parts' | 'guide'; title: string; text: string }
/**
 * Обещание ЯМузыканта в две части: главное — Фермата, крупно слева, — и три коротких строки справа: проверка мастером, Кофр-доставка, поддержка людьми.
 */
export interface TrustStripProps { items?: TrustItem[] }
export declare function TrustStrip(props: TrustStripProps): JSX.Element;
