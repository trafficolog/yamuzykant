import type * as React from "react";
/**
 * Подборка аксессуаров в карточке инструмента: заголовок с названием модели, чипы групп (струны, чехлы, звукосниматели, ремни) и горизонтальная лента AccessoryCard .
 */
export interface AccessoryRailProps { title?: string; groups: { name: string; items: AccessoryCardProps[] }[] }
export declare function AccessoryRail(props: AccessoryRailProps): JSX.Element;
