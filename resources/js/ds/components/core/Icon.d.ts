import type * as React from "react";
export type IconName = 'heart' | 'search' | 'shopping-bag' | 'message-circle' | 'user' | 'shield-check' | 'wrench' | 'package' | 'truck' | 'map-pin' | 'star' | 'camera' | 'tag' | 'badge-check' | 'guitar' | 'piano' | 'drum' | 'mic' | 'headphones' | 'speaker' | 'cable' | 'sliders-horizontal' | 'clock' | 'check' | 'x' | 'chevron-right' | 'chevron-down' | 'plus' | 'info' | 'triangle-alert' | 'circle-alert' | 'circle-check' | 'history' | 'scan-barcode' | 'hammer' | 'handshake' | 'bell' | 'arrow-down-right' | 'locate-fixed' | 'store' | 'layout-grid' | 'calendar-clock' | 'boxes' | 'menu' | 'minus';
export type Tone = 'neutral' | 'accent' | 'service' | 'guide' | 'parts' | 'info' | 'warning' | 'danger' | 'sale' | 'solid';
export type Condition = 'new' | 'mint' | 'excellent' | 'very-good' | 'good' | 'fair' | 'poor' | 'parts';
/**
 * Иконки Lucide (лицензия ISC): обводка 2 px, скругления, сетка 24 px, цвет наследуется через currentColor .
 */
export interface IconProps { name: IconName; size?: number; label?: string; className?: string }
export declare function Icon(props: IconProps): JSX.Element;
