import { Button, Icon, TrustStrip, type IconName } from '@ds';
import { Link, router } from '@inertiajs/react';
import type { ReactNode } from 'react';

import { CITY_TOGGLE_ID } from '@/Components/CitySelect';
import EmptyState from '@/Components/EmptyState';
import FleaListingCard from '@/Components/FleaListingCard';
import type { CategoryOption } from '@/Components/FleaFilterPanel';
import { useRequireAuth } from '@/Hooks/useAuthUser';
import PublicLayout from '@/Layouts/PublicLayout';
import { ru } from '@/lang/ru';
import { fleaPath, lotPath, SELL_PATH } from '@/lib/paths';
import type { FleaCard } from '@/Pages/Flea/Index';

/** Столько видов инструмента показывает главная (SPEC, карточка 3.1.4). */
const CATEGORIES_SHOWN = 8;

const TRUST_ICONS: IconName[] = ['message-circle', 'map-pin', 'tag'];
const TRUST_TONES = ['accent', 'service', 'parts'] as const;

type Condition = 'new' | 'mint' | 'excellent' | 'very-good' | 'good' | 'fair' | 'poor' | 'parts';

export interface HomeProps {
    /** Рельсы города шапки: карточки — белый список полей сервера (FleaListingResource). */
    rails: { fresh: FleaCard[]; negotiable: FleaCard[] };
    /** «г. Москва»: без склонения, тип населённого пункта из справочника. */
    cityLabel: string | null;
    /** Shared prop: дерево видимых категорий. */
    categories: CategoryOption[];
}

const t = ru.home;

interface RailProps {
    title: string;
    cards: FleaCard[];
    allLabel: string;
    allHref: string;
}

/** Рельс: заголовок, ссылка «все» и сетка карточек Барахолки (цена по BR-11 — в FleaListingCard). */
function Rail({ title, cards, allLabel, allHref }: RailProps) {
    const titleId = `home-rail-${allHref.replace(/\W+/g, '-')}`;

    return (
        <section aria-labelledby={titleId} className="ym-home__rail">
            <div className="ym-home__rail-head">
                <h2 id={titleId} className="h2 ym-title">
                    {title}
                </h2>
                <Link href={allHref} className="label ym-home__all">
                    {allLabel}
                </Link>
            </div>
            <div className="ym-home__grid">
                {cards.map((card) => (
                    <FleaListingCard
                        key={card.id}
                        title={card.title}
                        href={lotPath(card.id)}
                        price={card.price}
                        condition={(card.condition ?? undefined) as Condition | undefined}
                        city={card.city}
                        posted={card.posted ?? undefined}
                        delivery={card.ship ? ru.flea.shipping : undefined}
                        safe={false}
                    />
                ))}
            </div>
        </section>
    );
}

export default function Home({ rails, cityLabel, categories }: HomeProps) {
    const requireAuth = useRequireAuth();
    const cityEmpty = rails.fresh.length === 0;
    const emptyText = cityLabel === null ? t.emptyCityUnknown : t.emptyCity(cityLabel);

    return (
        <div className="ym-home">
            <h1 className="ym-sr">{t.title}</h1>

            <div className="ym-home__top">
                <nav aria-label={t.categoriesLabel} className="ym-home__cats">
                    <ul className="ym-home__cats-list">
                        {categories.slice(0, CATEGORIES_SHOWN).map((category) => (
                            <li key={category.id}>
                                <Link href={fleaPath(category.slug)} className="ym-home__cat">
                                    <span className="ym-home__cat-icon" aria-hidden="true">
                                        <Icon
                                            name={(category.icon ?? 'layout-grid') as IconName}
                                            size={28}
                                        />
                                    </span>
                                    <span className="body-s ym-home__cat-name">
                                        {category.name}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                <section aria-labelledby="home-sell-title" className="ym-home__sell">
                    <div className="ym-home__sell-text">
                        <h2 id="home-sell-title" className="ym-home__sell-title">
                            {t.sell.title}
                        </h2>
                        <p className="body-s ym-home__sell-lead">{t.sell.text}</p>
                    </div>
                    <div className="ym-home__sell-action">
                        <Button
                            variant="primary"
                            size="s"
                            icon="plus"
                            href={SELL_PATH}
                            onClick={(event) => {
                                // Гость: сначала вход, затем форма (как «Продать инструмент» в шапке).
                                event.preventDefault();
                                requireAuth(() => router.visit(SELL_PATH), event.currentTarget);
                            }}
                        >
                            {t.sell.title}
                        </Button>
                    </div>
                </section>
            </div>

            {cityEmpty ? (
                <EmptyState
                    icon="map-pin"
                    action={{
                        label: t.changeCity,
                        onClick: () => document.getElementById(CITY_TOGGLE_ID)?.click(),
                    }}
                >
                    {emptyText}
                </EmptyState>
            ) : (
                <>
                    <Rail
                        title={t.fresh(cityLabel ?? '')}
                        cards={rails.fresh}
                        allLabel={t.freshAll}
                        allHref={fleaPath()}
                    />
                    {rails.negotiable.length > 0 ? (
                        <Rail
                            title={t.negotiable}
                            cards={rails.negotiable}
                            allLabel={t.negotiableAll}
                            allHref={`${fleaPath()}?negotiable=1`}
                        />
                    ) : null}
                </>
            )}

            <TrustStrip
                items={t.trust.map((item, index) => ({
                    icon: TRUST_ICONS[index] ?? 'info',
                    tone: TRUST_TONES[index] ?? 'accent',
                    title: item.title,
                    text: item.text,
                }))}
            />
        </div>
    );
}

/** Каркас: вкладка «Главная» нижней панели; поиск шапки открывает Барахолку с запросом. */
Home.layout = (page: ReactNode) => (
    <PublicLayout
        tab="home"
        onSearch={(query) => {
            const q = query.trim();
            router.get(fleaPath(), q === '' ? {} : { q });
        }}
    >
        {page}
    </PublicLayout>
);
