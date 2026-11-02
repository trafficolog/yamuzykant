import type * as React from "react";
import type { Tone } from "../core/Icon";
import type { TimelineStep } from "./Timeline";
/**
 * Карточка заказа ремонта в кабинете клиента и мастера: номер моноширинным, инструмент, работа, статус, шкала этапов и сумма в Фермате.
 */
export interface RepairOrderCardProps { number: string; instrument: string; work?: string; status: string; statusTone?: Tone; steps: TimelineStep[]; amount: number; master?: string; action?: string }
export declare function RepairOrderCard(props: RepairOrderCardProps): JSX.Element;
