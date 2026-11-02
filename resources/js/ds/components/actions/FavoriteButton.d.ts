import type * as React from "react";
/**
 * Круглая кнопка «В избранное» с сердцем поверх фото лота; включённое состояние — заливка цветом danger .
 */
export interface FavoriteButtonProps { active?: boolean; count?: number; onToggle?: (next: boolean) => void }
export declare function FavoriteButton(props: FavoriteButtonProps): JSX.Element;
