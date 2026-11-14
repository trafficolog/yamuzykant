import { Button } from '@ds';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AuthUser } from '@/Hooks/useAuthUser';
import { ru } from '@/lang/ru';
import { hardNavigate } from '@/lib/navigate';
import { HREF_SOON, LISTINGS_PATH, MESSAGES_PATH, PROFILE_PATH } from '@/lib/paths';
import { postJson } from '@/lib/postJson';

/** Выход: POST с CSRF (cookie XSRF-TOKEN); сервер завершает сессию и меняет токен. */
const LOGOUT_URL = '/auth/logout';

/** Ответы, после которых сессии уже нет (401, 419), считаются выходом: на главную. */
const GONE = [401, 419];

export interface AccountPanelProps {
    id: string;
    user: AuthUser;
    /** `dropdown` — под кнопкой шапки; `sheet` — над нижней панелью (< 640 px). */
    variant: 'dropdown' | 'sheet';
}

/**
 * Меню кабинета (DEVIATIONS «account»): «Покупаю», «Продаю», общие «Сообщения» и «Профиль», «Выйти».
 * «Сообщения» — экран сообщений (4.1.2); остальных разделов пока нет: ссылки ведут на заглушку (lib/paths).
 */
export default function AccountPanel({ id, user, variant }: AccountPanelProps) {
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const busyRef = useRef(false);
    const alive = useRef(true);

    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);

    const logout = useCallback(async () => {
        if (busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        setFailed(false);

        try {
            const { status } = await postJson(LOGOUT_URL, {});
            if ((status >= 200 && status < 300) || GONE.includes(status)) {
                hardNavigate('/');
                return;
            }
            throw new Error(`logout ${status}`);
        } catch {
            if (alive.current) setFailed(true);
        } finally {
            busyRef.current = false;
            if (alive.current) setBusy(false);
        }
    }, []);

    return (
        <div
            id={id}
            role="group"
            aria-label={ru.account.label}
            className={`ym-account__panel ym-account__panel--${variant}`}
        >
            <p className="ym-account__name">{user.name}</p>

            <p className="ym-account__group">{ru.account.buy}</p>
            <a className="ym-account__link" href={HREF_SOON}>
                {ru.account.favorites}
            </a>

            <p className="ym-account__group">{ru.account.sell}</p>
            <a className="ym-account__link" href={LISTINGS_PATH}>
                {ru.account.listings}
            </a>

            <hr className="ym-account__rule" />
            <a className="ym-account__link" href={MESSAGES_PATH}>
                {ru.account.messages}
            </a>
            <a className="ym-account__link" href={PROFILE_PATH}>
                {ru.account.profile}
            </a>

            {failed ? (
                <p role="alert" className="ym-account__error">
                    {ru.account.logoutFailed}
                </p>
            ) : null}
            <Button variant="outline" block loading={busy} onClick={() => void logout()}>
                {ru.account.logout}
            </Button>
        </div>
    );
}
