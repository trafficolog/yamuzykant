import { afterEach, describe, expect, it, vi } from 'vitest';

import { authorizeChannel, echoOptions } from '@/realtime/echo';

// 4.1.1: клиент Reverb. Настройки — из shared prop `realtime` (без секрета), авторизация канала —
// POST /broadcasting/auth с сессией и XSRF, как остальные запросы приложения.

afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
});

describe('echoOptions', () => {
    it('https: только wss, порт и хост из настроек', () => {
        const options = echoOptions({
            key: 'k',
            host: 'ws.example.test',
            port: 443,
            scheme: 'https',
        });

        expect(options).toMatchObject({
            broadcaster: 'reverb',
            key: 'k',
            wsHost: 'ws.example.test',
            wsPort: 443,
            wssPort: 443,
            forceTLS: true,
            enabledTransports: ['wss'],
        });
    });

    it('http (local, e2e): ws без TLS', () => {
        const options = echoOptions({ key: 'k', host: '127.0.0.1', port: 8080, scheme: 'http' });

        expect(options).toMatchObject({ forceTLS: false, wsPort: 8080, enabledTransports: ['ws'] });
    });
});

describe('authorizeChannel', () => {
    it('отправляет socket_id и канал с XSRF-токеном и возвращает подпись', async () => {
        document.cookie = 'XSRF-TOKEN=abc%3D';
        const fetchMock = vi
            .fn()
            .mockResolvedValue(
                new Response(JSON.stringify({ auth: 'k:signature' }), { status: 200 }),
            );
        vi.stubGlobal('fetch', fetchMock);

        await expect(authorizeChannel('1.2', 'private-conversation.x')).resolves.toEqual({
            auth: 'k:signature',
        });

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('/broadcasting/auth');
        expect(init.method).toBe('POST');
        expect(init.credentials).toBe('same-origin');
        expect((init.headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('abc=');
        expect(JSON.parse(init.body as string)).toEqual({
            socket_id: '1.2',
            channel_name: 'private-conversation.x',
        });
    });

    it('отказ сервера (403) — ошибка, а не подписка', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));

        await expect(authorizeChannel('1.2', 'private-conversation.x')).rejects.toThrow('403');
    });
});
