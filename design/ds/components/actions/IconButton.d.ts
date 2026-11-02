import type * as React from "react";
import type { IconName } from "../core/Icon";
/**
 * Иконка с короткой подписью под ней для шапки и нижнего таб-бара; счётчик — зелёная капля accent в правом верхнем углу.
 */
export interface IconButtonProps { icon: IconName; label: string; count?: number; showLabel?: boolean; href?: string; onClick?: () => void }
export declare function IconButton(props: IconButtonProps): JSX.Element;
