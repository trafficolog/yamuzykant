import type * as React from "react";
import type { Condition } from "../core/Icon";
/**
 * Состояние лота по шкале ЯМузыканта из восьми ступеней; б/у получают префикс «Б/у ·», как «Used –» у Reverb.
 */
export interface ConditionBadgeProps { condition: Condition }
export declare function ConditionBadge(props: ConditionBadgeProps): JSX.Element;
