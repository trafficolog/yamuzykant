import type * as React from "react";
export interface NearbyMaster { name: string; rating: number; reviews?: number; distance: string; priceFrom: number; slot?: string }
/**
 * Блок «Ремонт и обслуживание» в карточке инструмента и модели: работа → место → мастер. Список работ зависит от раздела инструмента, список мастеров — от геопозиции посетителя.
 */
export interface ServicePickerProps { id?: string; category: string; services: string[]; service?: string; geo?: 'prompt' | 'loading' | 'granted' | 'denied'; place?: string; masters?: NearbyMaster[]; remote?: number; cities?: string[];
  /** Нажали «Найти мастеров рядом» — здесь вызывается navigator.geolocation. */
  onLocate?: () => void;
  /** Выбран город; null — человек нажал «Выбрать город». */
  onPickCity?: (city: string | null) => void;
  onService?: (service: string) => void;
  onBook?: (master: NearbyMaster, service: string) => void }
export declare function ServicePicker(props: ServicePickerProps): JSX.Element;
