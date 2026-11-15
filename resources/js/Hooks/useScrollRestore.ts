import { useEffect } from 'react';

const key = (): string => `ym-scroll:${window.location.pathname}${window.location.search}`;

/** Гидратация и загрузка шрифтов и фото могут сбросить прокрутку после первой попытки: повторяем. */
const RETRY_MS = [0, 100, 300, 800];

/** Пользователь начал прокручивать сам: дальнейшие повторы только мешали бы ему. */
const USER_SCROLL = ['wheel', 'touchstart', 'keydown'] as const;

/**
 * «Назад» после полной перезагрузки страницы (без bfcache): прокрутка возвращается на прежнюю позицию.
 * Позиция пишется в sessionStorage по адресу, когда страница уходит или вкладка скрывается, а читается
 * один раз (запись удаляется) и только при переходе «назад/вперёд»; обычный заход и обновление не трогаются.
 */
export default function useScrollRestore(): void {
    useEffect(() => {
        const timers: number[] = [];
        const cancelRetries = () => timers.forEach((timer) => window.clearTimeout(timer));
        const nav = performance.getEntriesByType('navigation')[0] as
            PerformanceNavigationTiming | undefined;

        try {
            const saved = nav?.type === 'back_forward' ? sessionStorage.getItem(key()) : null;
            if (saved !== null) {
                sessionStorage.removeItem(key());
                const top = Number(saved);
                for (const delay of RETRY_MS) {
                    if (delay === 0) window.scrollTo(0, top);
                    else timers.push(window.setTimeout(() => window.scrollTo(0, top), delay));
                }
            }
        } catch {
            // sessionStorage недоступен (приватный режим): остаёмся наверху.
        }

        const save = () => {
            try {
                sessionStorage.setItem(key(), String(window.scrollY));
            } catch {
                // sessionStorage недоступен: позиция не сохраняется.
            }
        };
        const saveWhenHidden = () => {
            if (document.visibilityState === 'hidden') save();
        };
        for (const type of USER_SCROLL) {
            window.addEventListener(type, cancelRetries, { once: true, passive: true });
        }
        window.addEventListener('pagehide', save);
        document.addEventListener('visibilitychange', saveWhenHidden);
        return () => {
            cancelRetries();
            for (const type of USER_SCROLL) window.removeEventListener(type, cancelRetries);
            window.removeEventListener('pagehide', save);
            document.removeEventListener('visibilitychange', saveWhenHidden);
        };
    }, []);
}
