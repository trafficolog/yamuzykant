import type * as React from "react";
export interface TimelineStep { label: string; meta?: string; state?: 'done' | 'current' | 'todo' }
/**
 * Шкала этапов сделки или ремонта: сегменты по 4 px, пройденные — сплошным цветом, текущий — полупрозрачным, будущие — line .
 */
export interface TimelineProps { steps: TimelineStep[]; tone?: 'accent' | 'service'; orientation?: 'horizontal' | 'vertical' }
export declare function Timeline(props: TimelineProps): JSX.Element;
