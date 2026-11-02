import type * as React from "react";
/**
 * Шапка карточки модели: название, ключевые характеристики и две плитки рядом — «Новое у партнёров» и «Б/у на барахолке» с ценой «от» и числом предложений.
 */
export interface ModelSummaryProps { name: string; category?: string; specs?: string[]; newFrom?: number; newCount?: number; usedFrom?: number; usedCount?: number; guide?: { low: number; high: number }; newHref?: string; usedHref?: string;
  /** Показать «гарантия производителя» — только если партнёры её подтверждают. */
  warranty?: boolean }
export declare function ModelSummary(props: ModelSummaryProps): JSX.Element;
