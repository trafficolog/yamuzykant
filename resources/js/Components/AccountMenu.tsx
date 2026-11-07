import { Button } from '@ds';
import { useRef } from 'react';

import AccountPanel from '@/Components/AccountPanel';
import type { AuthUser } from '@/Hooks/useAuthUser';
import { useDisclosure } from '@/Hooks/useDisclosure';
import { ru } from '@/lang/ru';

const TOGGLE_ID = 'site-account-toggle';
const PANEL_ID = 'site-account-panel';

/** Кнопка кабинета в шапке вместо «Войти»: имя пользователя и выпадающее меню под ней. */
export default function AccountMenu({ user }: { user: AuthUser }) {
    const rootRef = useRef<HTMLDivElement>(null);
    const { open, toggle } = useDisclosure(rootRef, TOGGLE_ID);

    return (
        <div ref={rootRef} className="ym-account">
            <Button
                id={TOGGLE_ID}
                variant="ghost"
                icon="user"
                aria-expanded={open}
                aria-controls={open ? PANEL_ID : undefined}
                aria-label={ru.account.menuLabel(user.name)}
                onClick={toggle}
            >
                <span className="ym-account__label">{user.name}</span>
            </Button>
            {open ? <AccountPanel id={PANEL_ID} user={user} variant="dropdown" /> : null}
        </div>
    );
}
