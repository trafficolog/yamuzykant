import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot, hydrateRoot } from 'react-dom/client';

import { installLoginInterceptor } from '@/Hooks/loginDialog';
import { ru } from '@/lang/ru';
import { initSentry } from '@/observability/sentry';

// Стили каркаса PublicLayout: после токенов ДС из resources/css/app.css.
import '../css/site.css';
import '../css/flea.css';

// Ошибки браузера в Sentry: без VITE_SENTRY_DSN выключено (CI, локальная разработка).
initSentry({
    dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined,
});

// 401 и 419 в переходах Inertia открывают окно входа (1.1.2).
installLoginInterceptor();

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
