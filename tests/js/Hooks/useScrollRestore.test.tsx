import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useScrollRestore from '@/Hooks/useScrollRestore';

// Карточка 3.1.9: «Назад» после полной перезагрузки (без bfcache) возвращает прежнюю позицию прокрутки.

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
        vi.restoreAllMocks();
        scrollTo.mockReset();
    });

    it('при уходе со страницы сохраняет прокрутку по ключу адреса', () => {
        navigationType('navigate');
        renderHook(() => useScrollRestore());

        window.dispatchEvent(new Event('pagehide'));

        expect(sessionStorage.getItem('ym-scroll:/baraholka?sort=cheap')).toBe('1200');
    });

    it('при возврате «Назад» восстанавливает сохранённую позицию', () => {
        sessionStorage.setItem('ym-scroll:/baraholka?sort=cheap', '1200');
        navigationType('back_forward');

        renderHook(() => useScrollRestore());

        expect(scrollTo).toHaveBeenCalledWith(0, 1200);
    });

    it('при обычном заходе и перезагрузке позицию не трогает', () => {
        sessionStorage.setItem('ym-scroll:/baraholka?sort=cheap', '1200');
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
