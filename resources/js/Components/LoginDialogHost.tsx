import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

import type { CityOption } from '@/Components/CityPicker';
import LoginDialog from '@/Components/LoginDialog';
import {
    closeLogin,
    currentPath,
    type LoginOutcome,
    openLogin,
    useLoginRequest,
} from '@/Hooks/loginDialog';

// Тип-алиас, а не interface: PageProps из @inertiajs/core требует индексной сигнатуры.
type HostProps = {
    city?: CityOption | null;
    /** Итог входа через Яндекс ID (flash `login_window`, 1.1.5): только на странице, куда вернул Яндекс. */
    login?: unknown;
    auth?: { user?: unknown };
};

declare global {
    interface Window {
        /** Клик по «Войти» до гидратации (скрипт в app.blade.php). */
        __ymLoginPending?: boolean;
    }
}

/** Итог Яндекса из shared prop; всё, что не похоже на известный итог, игнорируется. */
function parseOutcome(login: unknown): LoginOutcome | null {
    if (typeof login !== 'object' || login === null) return null;

    const value = login as Record<string, unknown>;
    if (value.status === 'yandex_cancelled' && typeof value.message === 'string') {
        return { status: 'yandex_cancelled', message: value.message };
    }
    if (value.status === 'registration_required') {
        return {
            status: 'registration_required',
            name: typeof value.name === 'string' ? value.name : null,
        };
    }
    if (value.status === 'email_required') return { status: 'email_required' };

    return null;
}

/**
 * Окно входа на странице: показывает его, когда кто-то вызвал openLogin (кнопка «Войти», вкладка «Кабинет»,
 * перехват 401 и 419) или когда после возврата от Яндекса пришёл итог в shared prop `login`.
 * Окно рисуется только в браузере: на сервере и при гидратации его нет, разметка не расходится.
 */
export default function LoginDialogHost() {
    const { props } = usePage<HostProps>();
    const request = useLoginRequest();
    const [mounted, setMounted] = useState(false);

    // Страница ожила: признак для e2e (вместо networkidle); клик по «Войти» до этого момента (app.blade.php)
    // сохранён в `__ymLoginPending` и открывает окно теперь, если пользователь не вошёл.
    useEffect(() => {
        setMounted(true);
        document.documentElement.dataset.hydrated = 'true';

        const pending = window.__ymLoginPending === true;
        delete window.__ymLoginPending;
        if (pending && !props.auth?.user) openLogin({ opener: null, returnTo: currentPath() });
        // Один раз при монтировании каркаса.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Итог Яндекса открывает окно сразу на нужном шаге; фокус вернётся на кнопку «Войти» шапки.
    useEffect(() => {
        const outcome = parseOutcome(props.login);
        if (outcome) openLogin({ outcome, opener: null, returnTo: currentPath() });
    }, [props.login]);

    if (!mounted || !request) return null;

    return (
        <LoginDialog
            city={props.city ?? null}
            returnTo={request.returnTo}
            outcome={request.outcome}
            opener={request.opener}
            onAuthenticated={request.onAuthenticated}
            onClose={closeLogin}
        />
    );
}
