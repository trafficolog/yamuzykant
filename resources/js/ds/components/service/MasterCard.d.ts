import type * as React from "react";
/**
 * Карточка мастера в выдаче «Мастера»: инициалы на service-soft , мастерская и рейтинг, специализации медными метками, три факта и запись.
 */
export interface MasterCardProps { name: string; workshop?: string; rating: number; reviews?: number; specialties?: string[]; priceFrom: number; eta: string; distance?: string; city?: string; verified?: boolean }
export declare function MasterCard(props: MasterCardProps): JSX.Element;
