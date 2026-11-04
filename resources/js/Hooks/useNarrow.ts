import { useEffect, useState } from 'react';

/** Порог шторки меню категорий и нижней панели (site.css, `@media (max-width: 639px)`). */
export const NARROW_QUERY = '(max-width: 639px)';

/**
 * Экран уже порога 640 px (шторка категорий, модальный диалог). На сервере и до монтирования — `false`:
 * меню на сервере не отрисовано (открыто только по клику), поэтому разметка гидратации не расходится.
 */
export function useNarrow(): boolean {
    const [narrow, setNarrow] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

        const query = window.matchMedia(NARROW_QUERY);
        const update = () => setNarrow(query.matches);
        update();
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);

    return narrow;
}
