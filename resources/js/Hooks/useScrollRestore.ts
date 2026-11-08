import { useEffect } from 'react';

const key = (): string => `ym-scroll:${window.location.pathname}${window.location.search}`;

/**
 * «Назад» после полной перезагрузки страницы (без bfcache): прокрутка возвращается на прежнюю позицию.
 * Позиция пишется в sessionStorage по адресу при уходе со страницы и читается только при переходе
 * «назад/вперёд»; обычный заход и обновление страницу не трогают.
 */
export default function useScrollRestore(): void {
    useEffect(() => {
        const nav = performance.getEntriesByType('navigation')[0] as
            PerformanceNavigationTiming | undefined;

        try {
            const saved = nav?.type === 'back_forward' ? sessionStorage.getItem(key()) : null;
            if (saved !== null) window.scrollTo(0, Number(saved));
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
        window.addEventListener('pagehide', save);
        return () => window.removeEventListener('pagehide', save);
    }, []);
}
