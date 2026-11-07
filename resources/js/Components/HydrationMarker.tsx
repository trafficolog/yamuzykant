import { useEffect } from 'react';

/**
 * Признак гидратации: после монтирования корня приложения `html[data-hydrated="true"]`.
 * Ставится в app.tsx, а не в раскладке страницы, поэтому есть на любой странице и раскладке.
 * Ждут его e2e (вместо `networkidle`) и public/js/pending-login.js.
 */
export default function HydrationMarker() {
    useEffect(() => {
        document.documentElement.dataset.hydrated = 'true';
    }, []);

    return null;
}
