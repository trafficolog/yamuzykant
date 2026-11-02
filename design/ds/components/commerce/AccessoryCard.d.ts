import type * as React from "react";
import type { IconName } from "../core/Icon";
/**
 * Компактная карточка аксессуара или детали: миниатюра 72 px, название в две строки, совместимость, цена и «В корзину» без перехода на страницу.
 */
export interface AccessoryCardProps { title: string; price: number; fit?: 'fits' | 'check'; image?: string; icon?: IconName; inCart?: boolean; href?: string;
  /** Управляемое добавление: идёт запрос, ошибка, колбэк. */
  adding?: boolean; error?: string; onAdd?: (next: boolean) => void }
export declare function AccessoryCard(props: AccessoryCardProps): JSX.Element;
