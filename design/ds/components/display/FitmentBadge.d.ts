import type * as React from "react";
/**
 * Плашка совместимости детали с инструментом: «Подходит к …», «Уточните совместимость с …», «Не подходит к …».
 */
export interface FitmentBadgeProps { target: string; status?: 'fits' | 'check' | 'no' }
export declare function FitmentBadge(props: FitmentBadgeProps): JSX.Element;
