import { Alert, Badge, Button, FilterChip, Icon } from '@ds';
import type { Tone } from '@ds';
import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import EmptyState from '@/Components/EmptyState';
import { LowerPriceDialog, WithdrawDialog } from '@/Components/ListingActionDialogs';
import AccountLayout from '@/Layouts/AccountLayout';
import { ru } from '@/lang/ru';
import { groupDigits, formatPrice } from '@/lib/messages';
import {
    FILTERS,
    actionsFor,
    type MyListing,
    type MyListingStatus,
    type MyListingsFilter,
} from '@/lib/myListings';
import { LISTINGS_PATH, SELL_PATH } from '@/lib/paths';

interface Props {
    listings: MyListing[];
    filter: MyListingsFilter;
    /** Сколько объявлений в каждой группе фильтра. */
    counts: Record<MyListingsFilter, number>;
}

const t = ru.account.listingsPage;

const TONES: Record<MyListingStatus, Tone> = {
    published: 'accent',
    pending: 'info',
    needs_changes: 'warning',
    rejected: 'danger',
    withdrawn: 'neutral',
    expired: 'neutral',
};

type Dialog = { kind: 'lower' | 'withdraw'; listing: MyListing } | null;

function Card({
    listing,
    onDialog,
    onAction,
}: {
    listing: MyListing;
    onDialog: (kind: 'lower' | 'withdraw', listing: MyListing) => void;
    onAction: (path: 'relist' | 'renew', listing: MyListing) => void;
}) {
    const can = actionsFor(listing);
    const reasonLabel = listing.status === 'rejected' ? t.rejectReason : t.returnReason;

    return (
        <li className="ym-my-listing">
            <a className="ym-my-listing__cover" href={listing.url} tabIndex={-1} aria-hidden="true">
                {listing.cover ? (
                    <picture>
                        <source srcSet={listing.cover.square.webp} type="image/webp" />
                        <img src={listing.cover.square.jpeg ?? listing.cover.square.webp} alt="" />
                    </picture>
                ) : (
                    <Icon name="tag" size={32} />
                )}
            </a>
            <div className="ym-my-listing__body">
                <div className="ym-my-listing__head">
                    <h3 className="type-h4 ym-my-listing__title">
                        <a href={listing.url}>{listing.title}</a>
                    </h3>
                    <Badge tone={TONES[listing.status]}>{t.statuses[listing.status]}</Badge>
                </div>
                <p className="ym-my-listing__price">{formatPrice(listing.price)}</p>
                <p className="type-body-s ym-my-listing__stats">
                    <span>
                        {t.views}: {groupDigits(listing.views)}
                    </span>
                    <span>
                        {t.chats}: {groupDigits(listing.chats)}
                    </span>
                </p>
                {listing.return_reason ? (
                    <p className="type-body-s ym-my-listing__reason">
                        <strong>{reasonLabel}.</strong> {listing.return_reason}
                    </p>
                ) : null}
                <div
                    role="group"
                    aria-label={t.actionsLabel(listing.title)}
                    className="ym-my-listing__actions"
                >
                    {can.edit ? (
                        <Button variant="outline" size="s" href={`/listings/${listing.id}/edit`}>
                            {t.edit}
                        </Button>
                    ) : null}
                    {can.lowerPrice ? (
                        <Button
                            variant="outline"
                            size="s"
                            onClick={() => onDialog('lower', listing)}
                        >
                            {t.lowerPrice}
                        </Button>
                    ) : null}
                    {can.renew ? (
                        <Button
                            variant="primary"
                            size="s"
                            onClick={() => onAction('renew', listing)}
                        >
                            {t.renew}
                        </Button>
                    ) : null}
                    {can.relist ? (
                        <Button
                            variant="primary"
                            size="s"
                            onClick={() => onAction('relist', listing)}
                        >
                            {t.relist}
                        </Button>
                    ) : null}
                    {can.withdraw ? (
                        <Button
                            variant="ghost"
                            size="s"
                            onClick={() => onDialog('withdraw', listing)}
                        >
                            {t.withdraw}
                        </Button>
                    ) : null}
                </div>
            </div>
        </li>
    );
}

/**
 * «Объявления» кабинета (UC-L3, UC-L4): фильтр по статусам, карточки со статусом, ценой, счётчиками и причиной
 * возврата; действия — изменить (форма продажи), снизить цену и снять с продажи (окна), вернуть в продажу, продлить.
 * Лимит активных объявлений (BR-06) при возврате и продлении показывается над списком.
 */
export default function AccountListings({ listings, filter, counts }: Props) {
    const [dialog, setDialog] = useState<Dialog>(null);
    const [problem, setProblem] = useState<string | null>(null);
    const { errors } = usePage<{ errors?: Record<string, string> }>().props;
    const shownProblem = problem ?? errors?.limit ?? errors?.listing ?? null;

    const choose = (next: MyListingsFilter) =>
        router.get(LISTINGS_PATH, next === 'all' ? {} : { status: next }, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });

    const act = (path: 'relist' | 'renew', listing: MyListing) => {
        setProblem(null);
        router.post(
            `/listings/${listing.id}/${path}`,
            {},
            {
                preserveScroll: true,
                onError: (serverErrors) =>
                    setProblem(serverErrors.limit ?? serverErrors.listing ?? t.failed),
            },
        );
    };

    return (
        <div className="ym-my-listings">
            <div className="ym-my-listings__head">
                <h2 className="type-h2 ym-my-listings__title">{t.title}</h2>
                <Button variant="primary" size="m" href={SELL_PATH} icon="plus">
                    {t.sell}
                </Button>
            </div>

            <div role="radiogroup" aria-label={t.filterLabel} className="ym-my-listings__filters">
                {FILTERS.map((key) => (
                    <FilterChip
                        key={key}
                        radio
                        selected={key === filter}
                        count={counts[key]}
                        onChange={() => choose(key)}
                    >
                        {t.filters[key]}
                    </FilterChip>
                ))}
            </div>

            {shownProblem ? (
                <Alert tone="danger" title={t.errorTitle}>
                    {shownProblem}
                </Alert>
            ) : null}

            {listings.length === 0 ? (
                <EmptyState icon="tag">{filter === 'all' ? t.empty : t.emptyFiltered}</EmptyState>
            ) : (
                <ul className="ym-my-listings__list">
                    {listings.map((listing) => (
                        <Card
                            key={listing.id}
                            listing={listing}
                            onDialog={(kind, item) => setDialog({ kind, listing: item })}
                            onAction={act}
                        />
                    ))}
                </ul>
            )}

            {dialog?.kind === 'lower' ? (
                <LowerPriceDialog listing={dialog.listing} onClose={() => setDialog(null)} />
            ) : null}
            {dialog?.kind === 'withdraw' ? (
                <WithdrawDialog listing={dialog.listing} onClose={() => setDialog(null)} />
            ) : null}
        </div>
    );
}

AccountListings.layout = (page: ReactNode) => (
    <AccountLayout active="listings">{page}</AccountLayout>
);
