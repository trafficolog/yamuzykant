import type * as React from "react";
import type { IconName } from "../core/Icon";
/**
 * Чип фильтра в выдаче: нажатый — подложка accent-soft и рамка accent ; счётчик результатов — ink-muted .
 */
export interface FilterChipProps { selected?: boolean; disabled?: boolean;
  /** Чип внутри radiogroup: role="radio", aria-checked, роуминг tabindex; повторное нажатие не снимает выбор. */
  radio?: boolean; count?: number; icon?: IconName; removable?: boolean; onChange?: (next: boolean) => void; children?: React.ReactNode }
export declare function FilterChip(props: FilterChipProps): JSX.Element;
