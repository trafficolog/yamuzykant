import { useCallback, useEffect, useRef, useState } from 'react';

import { openLogin } from '@/Hooks/loginDialog';
import { useRequireAuth } from '@/Hooks/useAuthUser';
import { setFavorite } from '@/lib/favoritesApi';

export interface FavoriteState {
    /** Объявление в избранном (оптимистично: меняется до ответа сервера). */
    active: boolean;
    /** Последняя попытка не удалась, сердце вернулось назад. */
    failed: boolean;
    /** Выставить состояние: гостю сначала откроется окно входа (1.1.2), после входа действие выполнится. */
    toggle: (next: boolean) => void;
}

/**
 * Сердце «В избранное» (UC-S5): состояние меняется сразу, запрос идёт следом; при ошибке — откат. Пока запрос
 * в пути, повторные клики игнорируются. Истёкшая сессия (401, 419) откатывает и открывает окно входа с повтором.
 * Новое значение `initial` с сервера (страница обновилась после входа) заменяет локальное.
 */
export function useFavorite(listingId: string, initial: boolean): FavoriteState {
    const requireAuth = useRequireAuth();
    const [active, setActive] = useState(initial);
    const [failed, setFailed] = useState(false);
    const busy = useRef(false);

    useEffect(() => setActive(initial), [initial]);

    const apply = useCallback(
        async (next: boolean): Promise<void> => {
            if (busy.current) return;
            busy.current = true;
            setFailed(false);
            setActive(next);

            try {
                const status = await setFavorite(listingId, next);
                if (status === 401 || status === 419) {
                    setActive(!next);
                    openLogin({ onAuthenticated: () => void apply(next) });
                } else if (status !== 200) {
                    setActive(!next);
                    setFailed(true);
                }
            } catch {
                setActive(!next);
                setFailed(true);
            } finally {
                busy.current = false;
            }
        },
        [listingId],
    );

    const toggle = useCallback(
        (next: boolean) => requireAuth(() => void apply(next)),
        [requireAuth, apply],
    );

    return { active, failed, toggle };
}
