import type * as React from "react";
/**
 * Звезда цвета guide-text , оценка с запятой и число отзывов в скобках: «4,9 (212)».
 */
export interface RatingProps { value: number; count?: number }
export declare function Rating(props: RatingProps): JSX.Element;
