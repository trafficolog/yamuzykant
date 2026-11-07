import Echo, { type EchoOptions } from 'laravel-echo';
import Pusher from 'pusher-js';

/** Настройки клиента Reverb из shared prop `realtime` (без секрета; у гостя — null). */
export interface RealtimeConfig {
    key: string;
    host: string;
    port: number;
    scheme: 'http' | 'https' | string;
}

/** Подпись подписки на приватный канал от /broadcasting/auth. */
export interface ChannelAuth {
    auth: string;
}

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : '';
}

/**
 * Авторизация приватного канала: POST /broadcasting/auth с сессией и XSRF, как остальные запросы
 * приложения. Чужой канал — 403 → ошибка, Echo не подписывается.
 */
export async function authorizeChannel(
    socketId: string,
    channelName: string,
): Promise<ChannelAuth> {
    const response = await fetch('/broadcasting/auth', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrfToken(),
        },
        body: JSON.stringify({ socket_id: socketId, channel_name: channelName }),
    });
    if (!response.ok) {
        throw new Error(String(response.status));
    }
    return (await response.json()) as ChannelAuth;
}

/** Параметры Echo для Reverb: https — только wss, http (local, e2e) — ws. */
export function echoOptions(config: RealtimeConfig): EchoOptions<'reverb'> {
    const tls = config.scheme === 'https';

    return {
        broadcaster: 'reverb',
        key: config.key,
        wsHost: config.host,
        wsPort: config.port,
        wssPort: config.port,
        forceTLS: tls,
        enabledTransports: [tls ? 'wss' : 'ws'],
        channelAuthorization: {
            endpoint: '/broadcasting/auth',
            transport: 'ajax',
            customHandler: (
                params: { socketId: string; channelName: string },
                callback: (error: Error | null, auth: ChannelAuth | null) => void,
            ) => {
                authorizeChannel(params.socketId, params.channelName).then(
                    (auth) => callback(null, auth),
                    (error: unknown) =>
                        callback(error instanceof Error ? error : new Error(String(error)), null),
                );
            },
        },
    };
}

let instance: Echo<'reverb'> | null = null;
let instanceKey = '';

/**
 * Один клиент Echo на вкладку. В SSR и без настроек (гость, Reverb выключен) — null: страница работает
 * без realtime и показывает данные из props.
 */
export function getEcho(config: RealtimeConfig | null | undefined): Echo<'reverb'> | null {
    if (typeof window === 'undefined' || !config) {
        return null;
    }
    const key = `${config.scheme}://${config.host}:${config.port}/${config.key}`;
    if (instance === null || instanceKey !== key) {
        instance?.disconnect();
        instance = new Echo<'reverb'>({ ...echoOptions(config), Pusher });
        instanceKey = key;
    }
    return instance;
}
