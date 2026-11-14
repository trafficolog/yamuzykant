import type { ReactNode } from 'react';

import { useAuthUser } from '@/Hooks/useAuthUser';
import AccountLayout from '@/Layouts/AccountLayout';
import { ru } from '@/lang/ru';
import { MESSAGES_PATH } from '@/lib/paths';

interface Props {
    /** «Покупаю»: непрочитанные чаты по чужим объявлениям. */
    buying: { unread_chats: number };
    /** «Продаю»: активные объявления и непрочитанные чаты по своим. */
    selling: { active_listings: number; unread_chats: number };
}

const t = ru.account.overviewPage;

function Tile({
    label,
    value,
    hint,
    href,
}: {
    label: string;
    value: number;
    hint: string;
    href?: string;
}) {
    const body = (
        <>
            <span className="type-body-s ym-account-tile__label">{label}</span>
            <span className="ym-account-tile__value">{value}</span>
            <span className="type-body-s ym-account-tile__hint">{hint}</span>
        </>
    );

    return href ? (
        <a className="ym-account-tile ym-account-tile--link" href={href}>
            {body}
        </a>
    ) : (
        <div className="ym-account-tile">{body}</div>
    );
}

/**
 * «Обзор» кабинета: блоки «Покупаю» и «Продаю» — тем, что уже есть (сообщения, объявления). Избранное
 * (4.3.1) и сохранённые поиски (4.3.2) добавят свои плитки, когда будут готовы.
 */
export default function AccountOverview({ buying, selling }: Props) {
    const user = useAuthUser();

    return (
        <div className="ym-account-overview">
            <h2 className="type-h1 ym-account-overview__greeting">
                {t.greeting(user?.name ?? '')}
            </h2>

            <section aria-label={ru.account.buy} className="ym-account-block">
                <h3 className="type-h3">{ru.account.buy}</h3>
                <div className="ym-account-tiles">
                    <Tile
                        label={t.unreadChats}
                        value={buying.unread_chats}
                        hint={t.buyHint}
                        href={MESSAGES_PATH}
                    />
                </div>
            </section>

            <section aria-label={ru.account.sell} className="ym-account-block">
                <h3 className="type-h3">{ru.account.sell}</h3>
                <div className="ym-account-tiles">
                    <Tile
                        label={t.activeListings}
                        value={selling.active_listings}
                        hint={t.activeHint}
                    />
                    <Tile
                        label={t.unreadChats}
                        value={selling.unread_chats}
                        hint={t.sellHint}
                        href={MESSAGES_PATH}
                    />
                </div>
            </section>
        </div>
    );
}

AccountOverview.layout = (page: ReactNode) => (
    <AccountLayout active="overview">{page}</AccountLayout>
);
