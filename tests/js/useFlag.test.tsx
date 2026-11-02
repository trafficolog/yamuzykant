import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useFlag } from '@/Hooks/useFlag';

let pageProps: Record<string, unknown> = {};

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: pageProps }),
}));

describe('useFlag', () => {
    it('useFlag("masters") = false по умолчанию', () => {
        pageProps = { flags: { masters: false } };

        const { result } = renderHook(() => useFlag('masters'));

        expect(result.current).toBe(false);
    });

    it('возвращает false, если сервер не передал flags', () => {
        pageProps = {};

        const { result } = renderHook(() => useFlag('masters'));

        expect(result.current).toBe(false);
    });

    it('возвращает true, когда сервер отдал true после включения флага в БД', () => {
        pageProps = { flags: { masters: true } };

        const { result } = renderHook(() => useFlag('masters'));

        expect(result.current).toBe(true);
    });
});
