import type * as React from "react";
export interface PassportEvent { date: string; kind: 'inspection' | 'repair' | 'sale' | 'setup'; text: string; by?: string }
/**
 * Паспорт инструмента: серийный номер, год, число владельцев и история проверок, ремонтов и сделок, новые сверху.
 */
export interface PassportCardProps { instrument: string; serial: string; year?: string; owners?: number; verified?: boolean; events?: PassportEvent[] }
export declare function PassportCard(props: PassportCardProps): JSX.Element;
