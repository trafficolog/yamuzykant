import { usePage } from '@inertiajs/react';
import { useCallback } from 'react';

import { openLogin } from '@/Hooks/loginDialog';

/** Вошедший в shared prop `auth.user` (HandleInertiaRequests): без почты и yandex_id (BR-04). */
export interface AuthUser {
    id: number;
    name: string;
    city: { id: number; name: string } | null;
    is_staff: boolean;
}

// Тип-алиас, а не interface: PageProps из @inertiajs/core требует индексной сигнатуры.
type AuthProps = { auth?: { user?: AuthUser | null } };

/** Вошедший пользователь или `null` (гость, ответ без prop). */
export function useAuthUser(): AuthUser | null {
    const { props } = usePage<AuthProps>();
    return props.auth?.user ?? null;
}

/**
 * Действие, требующее входа («Написать», «В избранное», «Продать»): у вошедшего выполняется сразу,
 * у гостя открывает окно входа и выполняется после входа (`onAuthenticated`, 1.1.2).
 * `opener` — элемент, на который вернуть фокус при закрытии окна.
 */
export function useRequireAuth(): (action: () => void, opener?: HTMLElement | null) => void {
    const user = useAuthUser();

    return useCallback(
        (action, opener) => {
            if (user) {
                action();
                return;
            }
            openLogin({ onAuthenticated: action, ...(opener === undefined ? {} : { opener }) });
        },
        [user],
    );
}
