import type * as React from "react";
import type { IconName, Condition } from "../core/Icon";
/**
 * Компактная карточка: квадратное фото; на нём слева вверху плашка-иконки статуса б/у (шкала состояния из 5 делений + щит «Безопасная сделка», подписи в title/aria-label), справа вверху сердце, слева внизу до двух меток. Под фото — цена, название в 2 строки, рейтинг, одна строка «доставка · город · давность». Кнопки по умолчанию нет.
 */
export interface ListingCardProps {
  title: string; price: number; oldPrice?: number; image?: string; icon?: IconName; condition?: Condition;
  /** Средняя оценка модели или товара, показывается строкой «★ 4,8 · 1 240 отзывов». */
  rating?: number; reviews?: number;
  /** Срок доставки: «Завтра», «Сегодня», «2–3 дня». Если задан, заменяет строку про стоимость доставки. */
  delivery?: string;
  city?: string; distance?: string; posted?: string; shipping?: number;
  /** Иконка «Безопасная сделка» у б/у; по умолчанию true. */
  safe?: boolean;
  /** Метка «Оригинал» — официальная поставка от партнёра. */
  partner?: boolean; inspected?: boolean; rare?: boolean; favorite?: boolean; href?: string;
  /** Кнопка в карточке. 'none' (по умолчанию) — без кнопки, переход по фото и названию; 'buy' — «Купить» (позже, для новых товаров); 'cart' — «В корзину» со счётчиком. «Написать продавцу» в карточке нет — оно на странице лота. */
  action?: 'none' | 'buy' | 'cart'; onBuy?: () => void;
  /** false — без кнопки; ctaLabel переопределяет подпись. */
  cta?: boolean; ctaLabel?: string;
  /** Количество в корзине; вместе с onQty — управляемый режим, иначе компонент хранит его сам. */
  inCart?: number; onQty?: (qty: number) => void;
}
export interface ConditionMeterProps { condition: Condition }
/** Шкала состояния б/у из 5 делений; подпись — в aria-label и title. */
export declare function ConditionMeter(props: ConditionMeterProps): JSX.Element;
export declare function ListingCard(props: ListingCardProps): JSX.Element;
