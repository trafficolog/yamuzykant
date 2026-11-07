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
};

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

    useEffect(() => setMounted(true), []);

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
