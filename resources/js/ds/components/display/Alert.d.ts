import type * as React from "react";
import type { IconName } from "../core/Icon";
/**
 * Сообщение на подложке тона с иконкой слева: заголовок — что случилось, текст — что делать дальше.
 */
export interface AlertProps { tone?: 'info' | 'success' | 'warning' | 'danger' | 'service'; title?: string; icon?: IconName; action?: string; children?: React.ReactNode }
export declare function Alert(props: AlertProps): JSX.Element;
