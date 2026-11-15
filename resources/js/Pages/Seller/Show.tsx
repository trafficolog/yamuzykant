import { Icon, type IconName } from '@ds';
import { Head, Link } from '@inertiajs/react';
import type { ReactNode } from 'react';

import Breadcrumbs from '@/Components/Breadcrumbs';
import EmptyState from '@/Components/EmptyState';
import LotListingCard from '@/Components/LotListingCard';
import Pagination from '@/Components/Pagination';
import PublicLayout from '@/Layouts/PublicLayout';
import { ru } from '@/lang/ru';
import { capitalize, memberSince } from '@/lib/account';
import { initials } from '@/lib/initials';
import { lotPath, sellerPath } from '@/lib/paths';
import type { LotSimilar } from '@/Pages/Lot/Show';

type ConditionKey = 'new' | 'mint' | 'excellent' | 'very-good' | 'good' | 'fair' | 'poor' | 'parts';

export type SellerTab = 'sale' | 'sold';

/** Проданное: без цены, фото и ссылки (SellerResource / SoldListingResource — белый список сервера). */
export interface SoldItem {
    id: string;
    title: string;
    city: string | null;
    sold: string | null;
}

export interface SellerShowProps {
    seller: {
        id: number;
        name: string;
        city: { type: string; name: string } | null;
        since: string | null;
    };
    tab: SellerTab;
    counts: { sale: number; sold: number };
    /** Карточки «В продаже» — те же поля, что у «Похожих» на лоте (ListingCardResource). */
    listings: LotSimilar[];
    sold: SoldItem[];
    pagination: { page: number; pages: number };
}

const t = ru.seller;

function Fact({ icon, children }: { icon: IconName; children: ReactNode }) {
    return (
        <span className="body-s ym-seller-page__fact">
            <Icon name={icon} size={16} />
            {children}
        </span>
    );
}

export default function SellerShow({
    seller,
    tab,
    counts,
    listings,
    sold,
    pagination,
}: SellerShowProps) {
    const since = memberSince(seller.since);
    const tabs: { key: SellerTab; label: string; count: number }[] = [
        { key: 'sale', label: t.onSale, count: counts.sale },
        { key: 'sold', label: t.sold, count: counts.sold },
    ];
    const tabQuery = (key: SellerTab) => (key === 'sold' ? ('sold' as const) : undefined);

    return (
        <>
            <Head title={seller.name} />
            <div className="ym-seller-page">
                <Breadcrumbs
                    items={[{ label: ru.breadcrumbs.home, href: '/' }, { label: seller.name }]}
                />

                <section aria-labelledby="seller-name" className="ym-seller-page__head">
                    <span className="ym-seller-page__avatar" aria-hidden="true">
                        {initials(seller.name)}
                    </span>
                    <div className="ym-seller-page__who">
                        <h1 id="seller-name" className="h1 ym-title ym-seller-page__name">
                            {seller.name}
                        </h1>
                        <div className="ym-seller-page__facts">
                            {seller.city !== null ? (
                                <Fact icon="map-pin">{`${seller.city.type} ${seller.city.name}`}</Fact>
                            ) : null}
                            {since !== null ? (
                                <Fact icon="history">{capitalize(since)}</Fact>
                            ) : null}
                            {counts.sold > 0 ? (
                                <Fact icon="circle-check">{t.sales(counts.sold)}</Fact>
                            ) : null}
                        </div>
                    </div>
                </section>

                <nav aria-label={t.tabsLabel} className="ym-seller-page__tabs">
                    {tabs.map(({ key, label, count }) => (
                        <Link
                            key={key}
                            href={sellerPath(seller.id, { tab: tabQuery(key) })}
                            aria-current={tab === key ? 'page' : undefined}
                            className="ym-seller-page__tab"
                        >
                            {label}
                            <span className="body-s ym-seller-page__count">{count}</span>
                        </Link>
                    ))}
                </nav>

                {tab === 'sale' ? (
                    listings.length === 0 ? (
                        <EmptyState icon="guitar">{t.emptyOnSale}</EmptyState>
                    ) : (
                        <ul
                            aria-label={t.listingsLabel}
                            className="ym-lot__grid ym-seller-page__list"
                        >
                            {listings.map((lot) => (
                                <li key={lot.id}>
                                    <LotListingCard
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
                                </li>
                            ))}
                        </ul>
                    )
                ) : sold.length === 0 ? (
                    <EmptyState icon="guitar">{t.emptySold}</EmptyState>
                ) : (
                    <ul aria-label={t.soldLabel} className="ym-seller-page__sold">
                        {sold.map((item) => (
                            <li key={item.id} className="ym-seller-page__sold-item">
                                <span className="body-l">{item.title}</span>
                                <span className="body-s ym-seller-page__sold-meta">
                                    {[item.city, item.sold !== null ? t.soldAt(item.sold) : null]
                                        .filter((part) => part !== null)
                                        .join(' · ')}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}

                <Pagination
                    page={pagination.page}
                    pages={pagination.pages}
                    href={(page) => sellerPath(seller.id, { tab: tabQuery(tab), page })}
                />
            </div>
        </>
    );
}

SellerShow.layout = (page: ReactNode) => (
    <PublicLayout active="flea" tab="search">
        {page}
    </PublicLayout>
);
