import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    closeLogin,
    getLoginRequest,
    installLoginInterceptor,
    openLogin,
    safeReturnPath,
} from '@/Hooks/loginDialog';

type InvalidHandler = (event: unknown) => void;
const { on } = vi.hoisted(() => ({ on: vi.fn() }));

vi.mock('@inertiajs/react', () => ({ router: { on, visit: vi.fn() } }));

beforeEach(() => {
    closeLogin();
    on.mockReset();
});

describe('safeReturnPath: возврат к действию — только относительные пути', () => {
    it.each([
        ['/baraholka', '/baraholka'],
        ['/baraholka?page=2', '/baraholka?page=2'],
        ['/lot/7#photos', '/lot/7#photos'],
        [`${window.location.origin}/lot/7?x=1`, '/lot/7?x=1'],
    ])('%s → %s', (input, expected) => {
        expect(safeReturnPath(input)).toBe(expected);
    });

    it.each([
        `${window.location.origin}//evil.example`,
        `${window.location.origin}//evil.example/x`,
        `${window.location.origin}/\\evil`,
        '%2F%2Fevil',
        'https://evil.example/steal',
        '//evil.example',
        '/\\evil.example',
        '/\t/evil.example',
        '/\n/evil.example',
        '/\r/evil.example',
        '/\t\\evil.example',
        'javascript:alert(1)',
        'baraholka',
        '',
        undefined,
        null,
    ])('%s → главная', (input) => {
        expect(safeReturnPath(input as string | null | undefined)).toBe('/');
    });
});

describe('хранилище окна входа', () => {
    it('openLogin открывает окно, closeLogin закрывает', () => {
        expect(getLoginRequest()).toBeNull();

        openLogin({ returnTo: '/lot/7' });
        expect(getLoginRequest()?.returnTo).toBe('/lot/7');

        closeLogin();
        expect(getLoginRequest()).toBeNull();
    });

    it('повторный openLogin при открытом окне его не подменяет', () => {
        openLogin({ returnTo: '/lot/7' });
        openLogin({ returnTo: '/other' });

        expect(getLoginRequest()?.returnTo).toBe('/lot/7');
    });
});

describe('перехват 401 и 419', () => {
    const invalid = (status: number, config: Record<string, unknown>) => {
        installLoginInterceptor();
        const handler = on.mock.calls.find(([name]) => name === 'invalid')?.[1] as InvalidHandler;
        const event = { detail: { response: { status, config } }, preventDefault: vi.fn() };
        handler(event);
        return event;
    };

    it.each([401, 419])(
        '%i: окно входа открывается, стандартный показ ответа отменён',
        (status) => {
            const event = invalid(status, { url: '/baraholka?page=2', method: 'get' });

            expect(event.preventDefault).toHaveBeenCalled();
            expect(getLoginRequest()?.returnTo).toBe('/baraholka?page=2');
        },
    );

    it('адрес прерванного GET-перехода — абсолютный того же сайта — сводится к пути', () => {
        invalid(401, { url: `${window.location.origin}/lot/7`, method: 'get' });

        expect(getLoginRequest()?.returnTo).toBe('/lot/7');
    });

    it('прерванное не-GET действие возвращает на текущую страницу', () => {
        window.history.pushState({}, '', '/lot/7');
        invalid(419, { url: '/favorites', method: 'post' });

        expect(getLoginRequest()?.returnTo).toBe('/lot/7');
    });

    it('другие ответы не перехватываются', () => {
        const event = invalid(500, { url: '/lot/7', method: 'get' });

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(getLoginRequest()).toBeNull();
    });

    it('снятие слушателя возвращает отписку из Inertia', () => {
        const off = vi.fn();
        on.mockReturnValue(off);

        installLoginInterceptor()();

        expect(off).toHaveBeenCalled();
    });
});
