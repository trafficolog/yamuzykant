import { Alert, Badge, Button, ConditionBadge, Icon, Textarea, type IconName } from '@ds';
import { Head } from '@inertiajs/react';
import { useState, type ReactNode } from 'react';

import Breadcrumbs, { type Crumb } from '@/Components/Breadcrumbs';
import LotGallery, { type LotPhoto } from '@/Components/LotGallery';
import LotListingCard from '@/Components/LotListingCard';
import LotPrice from '@/Components/LotPrice';
import PublicLayout from '@/Layouts/PublicLayout';
import { openLogin } from '@/Hooks/loginDialog';
import { ru } from '@/lang/ru';
import { HREF_SOON, fleaPath, lotPath } from '@/lib/paths';
import { postJson } from '@/lib/postJson';

type ConditionKey = 'new' | 'mint' | 'excellent' | 'very-good' | 'good' | 'fair' | 'poor' | 'parts';

export type LotStatus =
    'draft' | 'pending' | 'published' | 'needs_changes' | 'rejected' | 'withdrawn' | 'expired';

/** Поля лота: белый список сервера (LotResource). Почты продавца, полного серийного номера и расстояния нет. */
export interface LotData {
    id: string;
    title: string;
    /** BR-11: сумма; `null` — «Договорная», `0` — «Бесплатно». */
    price: number | null;
    negotiable: boolean;
    condition: { value: string; label: string } | null;
    year: number | null;
    brand: string | null;
    model: string | null;
    /** Маска: `V09****`. */
    serial: string | null;
    description: string | null;
    city: string | null;
    meet: boolean;
    ship: boolean;
    posted: string | null;
    status: LotStatus;
    sold: boolean;
}

export interface LotSimilar {
    id: string;
    title: string;
    price: number | null;
    condition: string | null;
    city: string | null;
    ship: boolean;
    negotiable: boolean;
    posted: string | null;
    image: string | null;
}

export interface LotShowProps {
    listing: LotData;
    crumbs: { name: string; path: string }[];
    photos: LotPhoto[];
    seller: { name: string; city: string | null; since: number | null };
    viewer: { authenticated: boolean; is_owner: boolean; is_staff: boolean };
    similar: LotSimilar[];
}

const t = ru.lot;

/** Плашка не опубликованного лота: видна владельцу и сотрудникам (остальным сервер отвечает 404). */
function statusLabel(listing: LotData): string | null {
    if (listing.status === 'published') return null;
    if (listing.status === 'withdrawn') return listing.sold ? t.status.sold : t.status.withdrawn;
    return t.status[listing.status];
}

function initials(name: string): string {
    const words = name.split(/\s+/).filter((word) => /^\p{L}/u.test(word));
    return (
        words
            .slice(0, 2)
            .map((word) => word.charAt(0))
            .join('')
            .toUpperCase() || '?'
    );
}

function DeliveryItem({
    icon,
    title,
    hint,
    accent = false,
}: {
    icon: IconName;
    title: string;
    hint: string;
    accent?: boolean;
}) {
    return (
        <li className="ym-lot__way">
            <span className={accent ? 'ym-lot__way-icon is-accent' : 'ym-lot__way-icon'}>
                <Icon name={icon} size={20} />
            </span>
            <span className="ym-lot__way-text">
                <span className="body ym-lot__way-title">{title}</span>
                <span className="body-s ym-lot__way-hint">{hint}</span>
            </span>
        </li>
    );
}

/** Поле первого сообщения продавцу (POST /listings/{id}/conversations, 4.1.1); экран переписки — 4.1.2. */
function Compose({ listingId, onSent }: { listingId: string; onSent: () => void }) {
    const [body, setBody] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const send = async () => {
        if (busy || body.trim() === '') return;
        setBusy(true);
        setError(null);
        try {
            const { status } = await postJson(`/listings/${listingId}/conversations`, { body });
            if (status === 201) {
                onSent();
            } else if (status === 401 || status === 419) {
                openLogin({ onAuthenticated: () => void send() });
            } else if (status === 429) {
                setError(t.compose.errorLimited);
            } else if (status === 404) {
                setError(t.compose.errorGone);
            } else {
                setError(t.compose.errorGeneric);
            }
        } catch {
            setError(t.compose.errorGeneric);
        } finally {
            setBusy(false);
        }
    };

    return (
        <form
            className="ym-lot__compose"
            onSubmit={(event) => {
                event.preventDefault();
                void send();
            }}
        >
            <Textarea
                label={t.compose.label}
                hint={t.compose.hint}
                rows={4}
                maxLength={2000}
                value={body}
                onChange={setBody}
            />
            {error !== null ? (
                <p role="alert" className="body-s ym-lot__error">
                    {error}
                </p>
            ) : null}
            <Button type="submit" variant="primary" loading={busy} disabled={body.trim() === ''}>
                {t.compose.send}
            </Button>
        </form>
    );
}

export default function LotShow({
    listing,
    crumbs,
    photos,
    seller,
    viewer,
    similar,
}: LotShowProps) {
    const [composing, setComposing] = useState(false);
    const [sent, setSent] = useState(false);

    const status = statusLabel(listing);
    const published = listing.status === 'published';
    const canWrite = published && !viewer.is_owner;
    const categoryPath = crumbs.length > 0 ? (crumbs[crumbs.length - 1]?.path ?? null) : null;

    const breadcrumbs: Crumb[] = [
        { label: ru.breadcrumbs.home, href: '/' },
        { label: t.flea, href: fleaPath() },
        ...crumbs.map((crumb) => ({ label: crumb.name, href: fleaPath(crumb.path) })),
        { label: listing.title },
    ];

    const write = () => {
        if (viewer.authenticated) {
            setComposing(true);
        } else {
            openLogin({ onAuthenticated: () => setComposing(true) });
        }
    };

    const specs: [string, string | number][] = [
        [t.spec.brand, listing.brand ?? ''],
        [t.spec.model, listing.model ?? ''],
        [t.spec.year, listing.year ?? ''],
        [t.spec.condition, listing.condition?.label ?? ''],
        [t.spec.serial, listing.serial ?? ''],
    ];

    let action: ReactNode = null;
    if (viewer.is_owner) {
        action = (
            <div className="ym-lot__owner">
                <p className="body ym-lot__owner-note">{t.ownListing}</p>
                <Button variant="outline" block href={HREF_SOON}>
                    {t.myListings}
                </Button>
            </div>
        );
    } else if (sent) {
        action = (
            <Alert tone="success" icon="circle-check" title={t.compose.sentTitle}>
                {t.compose.sentText}
            </Alert>
        );
    } else if (canWrite && composing) {
        action = <Compose listingId={listing.id} onSent={() => setSent(true)} />;
    } else if (canWrite) {
        action = (
            <div>
                <Button variant="primary" size="l" block icon="message-circle" onClick={write}>
                    {t.write}
                </Button>
            </div>
        );
    }

    return (
        <>
            <Head title={listing.title} />
            <div className="ym-lot">
                <Breadcrumbs items={breadcrumbs} />

                <div className="ym-lot__top">
                    <LotGallery photos={photos} title={listing.title} />

                    <section aria-labelledby="lot-title" className="ym-lot__buy">
                        <div className="ym-lot__head">
                            <h1 id="lot-title" className="h2 ym-lot__title">
                                {listing.title}
                            </h1>
                            <div className="ym-lot__badges">
                                {listing.condition !== null ? (
                                    <ConditionBadge
                                        condition={listing.condition.value as ConditionKey}
                                    />
                                ) : null}
                                {listing.negotiable ? (
                                    <Badge tone="accent">{t.negotiable}</Badge>
                                ) : null}
                            </div>
                        </div>

                        {status !== null ? (
                            <div data-testid="lot-status">
                                <Alert tone="info" icon="info" title={status}>
                                    {t.status.hint}
                                </Alert>
                            </div>
                        ) : null}

                        <LotPrice price={listing.price} />

                        {action}

                        <ul aria-label={t.delivery.label} className="ym-lot__ways">
                            {listing.ship ? (
                                <DeliveryItem
                                    icon="truck"
                                    title={t.delivery.ship}
                                    hint={t.delivery.shipHint}
                                    accent
                                />
                            ) : null}
                            {listing.meet ? (
                                <DeliveryItem
                                    icon="map-pin"
                                    title={
                                        listing.city !== null
                                            ? t.delivery.meet(listing.city)
                                            : t.delivery.meetAnyCity
                                    }
                                    hint={t.delivery.meetHint}
                                />
                            ) : null}
                            <DeliveryItem
                                icon="shield-check"
                                title={t.delivery.chat}
                                hint={t.delivery.chatHint}
                                accent
                            />
                        </ul>

                        {listing.posted !== null ? (
                            <p className="body-s ym-lot__meta" data-dynamic>
                                {t.posted(listing.posted)}
                            </p>
                        ) : null}
                    </section>
                </div>

                <div className="ym-lot__body">
                    <div className="ym-lot__main">
                        {listing.description ? (
                            <section className="ym-lot__section">
                                <h2 className="h3">{t.description}</h2>
                                <p className="body-l ym-lot__description">{listing.description}</p>
                            </section>
                        ) : null}

                        <section className="ym-lot__section">
                            <h2 className="h3">{t.specs}</h2>
                            <dl className="ym-lot__specs">
                                {specs
                                    .filter(([, value]) => value !== '')
                                    .map(([name, value]) => (
                                        <div key={name} className="ym-lot__spec">
                                            <dt className="body">{name}</dt>
                                            <dd className="body">{value}</dd>
                                        </div>
                                    ))}
                            </dl>
                        </section>
                    </div>

                    <aside className="ym-lot__aside">
                        <section className="ym-panel" aria-label={t.seller.label}>
                            <div className="ym-seller__top">
                                <span className="ym-avatar" aria-hidden="true">
                                    {initials(seller.name)}
                                </span>
                                <div className="ym-lot__seller-text">
                                    <p className="ym-seller__name">{seller.name}</p>
                                    {seller.city !== null ? (
                                        <div className="ym-card__meta">
                                            <span>{seller.city}</span>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                            {seller.since !== null ? (
                                <div className="ym-card__meta">{t.seller.since(seller.since)}</div>
                            ) : null}
                        </section>
                    </aside>
                </div>

                {similar.length > 0 ? (
                    <section className="ym-lot__similar">
                        <div className="ym-lot__similar-head">
                            <h2 className="h2">{t.similar}</h2>
                            <a href={fleaPath(categoryPath)} className="label ym-lot__similar-all">
                                {t.allInFlea}
                            </a>
                        </div>
                        <div className="ym-lot__grid">
                            {similar.map((lot) => (
                                <LotListingCard
                                    key={lot.id}
                                    title={lot.title}
                                    price={lot.price}
                                    href={lotPath(lot.id)}
                                    condition={
                                        (lot.condition ?? undefined) as ConditionKey | undefined
                                    }
                                    city={lot.city ?? undefined}
                                    posted={lot.posted ?? undefined}
                                    image={lot.image ?? undefined}
                                />
                            ))}
                        </div>
                    </section>
                ) : null}
            </div>
        </>
    );
}

LotShow.layout = (page: ReactNode) => (
    <PublicLayout active="flea" tab="search">
        {page}
    </PublicLayout>
);
