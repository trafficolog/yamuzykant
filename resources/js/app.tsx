import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot, hydrateRoot } from 'react-dom/client';

import { ru } from '@/lang/ru';

// Стили каркаса PublicLayout: после токенов ДС из resources/css/app.css.
import '../css/site.css';

void createInertiaApp({
    title: (title) => (title ? `${title} — ${ru.brand}` : ru.brand),
    resolve: (name) =>
        resolvePageComponent(`./Pages/${name}.tsx`, import.meta.glob('./Pages/**/*.tsx')),
    setup({ el, App, props }) {
        // Если сервер отдал SSR-разметку, гидрируем её, иначе рендерим с нуля.
        if (el.hasChildNodes()) {
            hydrateRoot(el, <App {...props} />);
            return;
        }
        createRoot(el).render(<App {...props} />);
    },
});
