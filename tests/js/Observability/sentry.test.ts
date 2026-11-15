import { describe, expect, it, vi } from 'vitest';

import { initSentry, readRequestId, scrubEvent } from '@/observability/sentry';

describe('Sentry на фронте', () => {
    it('без DSN Sentry не инициализируется', () => {
        const init = vi.fn();

        expect(initSentry({ dsn: undefined, release: 'abc', init })).toBe(false);
        expect(initSentry({ dsn: '', release: 'abc', init })).toBe(false);
        expect(init).not.toHaveBeenCalled();
    });

    it('с DSN вызывает init с release и фильтром beforeSend', () => {
        const init = vi.fn();

        expect(initSentry({ dsn: 'https://key@sentry.example/1', release: 'abc123', init })).toBe(
            true,
        );
        expect(init).toHaveBeenCalledWith(
            expect.objectContaining({
                dsn: 'https://key@sentry.example/1',
                release: 'abc123',
                beforeSend: scrubEvent,
            }),
        );
    });

    it('beforeSend убирает e-mail, код входа, куки, IP и тело запроса', () => {
        const event = {
            message: 'Не вышло войти anna@example.com',
            user: { id: '42', email: 'anna@example.com', ip_address: '203.0.113.5' },
            request: {
                url: 'https://stage.example.test/?email=anna@example.com',
                cookies: { ym_session: 'secret' },
                headers: { Cookie: 'ym_session=secret', 'X-Request-Id': 'r1' },
                data: { email: 'anna@example.com', code: '123456' },
            },
            extra: { code: '123456', note: 'письмо anna@example.com' },
            breadcrumbs: [{ message: 'клик anna@example.com' }],
        };

        const dump = JSON.stringify(scrubEvent(event));

        expect(dump).not.toContain('anna@example.com');
        expect(dump).not.toContain('123456');
        expect(dump).not.toContain('203.0.113.5');
        expect(dump).not.toContain('ym_session');
        expect(dump).toContain('"id":"42"');
    });

    it('с requestId события несут тег request_id', () => {
        const init = vi.fn();

        initSentry({
            dsn: 'https://key@sentry.example/1',
            release: 'abc',
            requestId: 'req-1',
            init,
        });

        expect(init).toHaveBeenCalledWith(
            expect.objectContaining({ initialScope: { tags: { request_id: 'req-1' } } }),
        );
    });

    it('requestId берётся из meta[name=request-id]', () => {
        document.head.innerHTML = '<meta name="request-id" content="req-meta-1">';
        expect(readRequestId()).toBe('req-meta-1');

        document.head.innerHTML = '';
        expect(readRequestId()).toBeUndefined();
    });
});
