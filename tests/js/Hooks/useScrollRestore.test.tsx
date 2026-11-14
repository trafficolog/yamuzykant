import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useScrollRestore from '@/Hooks/useScrollRestore';

// Карточка 3.1.9: «Назад» после полной перезагрузки (без bfcache) возвращает прежнюю позицию прокрутки.

const KEY = 'ym-scroll:/baraholka?sort=cheap';

const navigationType = (type: string) =>
    vi
        .spyOn(performance, 'getEntriesByType')
        .mockReturnValue([{ type }] as unknown as PerformanceEntryList);

describe('useScrollRestore', () => {
    const scrollTo = vi.fn();

    beforeEach(() => {
        sessionStorage.clear();
        window.scrollTo = scrollTo;
        window.history.replaceState(null, '', '/baraholka?sort=cheap');
        Object.defineProperty(window, 'scrollY', { value: 1200, configurable: true });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        scrollTo.mockReset();
    });

    it('при уходе со страницы (pagehide) сохраняет прокрутку по ключу адреса', () => {
        navigationType('navigate');
        renderHook(() => useScrollRestore());

        window.dispatchEvent(new Event('pagehide'));

        expect(sessionStorage.getItem(KEY)).toBe('1200');
    });

    it('сохраняет прокрутку и когда вкладка скрывается (visibilitychange)', () => {
        navigationType('navigate');
        renderHook(() => useScrollRestore());
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

        document.dispatchEvent(new Event('visibilitychange'));

        expect(sessionStorage.getItem(KEY)).toBe('1200');
    });

    it('при возврате «Назад» восстанавливает позицию один раз и удаляет запись', () => {
        sessionStorage.setItem(KEY, '1200');
        navigationType('back_forward');

        renderHook(() => useScrollRestore());

        expect(scrollTo).toHaveBeenCalledWith(0, 1200);
        expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it('повторяет прокрутку, пока гидратация не сбросила позицию', () => {
        vi.useFakeTimers();
        sessionStorage.setItem(KEY, '1200');
        navigationType('back_forward');

        renderHook(() => useScrollRestore());
        scrollTo.mockClear();
        vi.advanceTimersByTime(500);

        expect(scrollTo).toHaveBeenCalledWith(0, 1200);
    });

    it('при обычном заходе и перезагрузке позицию не трогает', () => {
        sessionStorage.setItem(KEY, '1200');
        for (const type of ['navigate', 'reload']) {
            navigationType(type);
            renderHook(() => useScrollRestore());
        }

        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('адрес с другими фильтрами не получает чужую позицию', () => {
        sessionStorage.setItem('ym-scroll:/baraholka', '1200');
        navigationType('back_forward');

        renderHook(() => useScrollRestore());

        expect(scrollTo).not.toHaveBeenCalled();
    });
});
