import { Alert, Button, FilterChip, Select, type IconName } from '@ds';
import { router, usePage } from '@inertiajs/react';
import { useEffect, useState, type ReactNode } from 'react';

import Breadcrumbs, { type Crumb } from '@/Components/Breadcrumbs';
import EmptyState from '@/Components/EmptyState';
import PricedListingCard from '@/Components/PricedListingCard';
import FleaListingSkeleton from '@/Components/FleaListingSkeleton';
import FleaFilterPanel, {
    type CategoryOption,
    type ConditionOption,
} from '@/Components/FleaFilterPanel';
import Pagination from '@/Components/Pagination';
import useScrollRestore from '@/Hooks/useScrollRestore';
import PublicLayout from '@/Layouts/PublicLayout';
import { ru } from '@/lang/ru';
import { lotPath } from '@/lib/paths';
import {
    EMPTY_FILTERS,
    FLEA_PATH,
    fleaHref,
    hasActiveFilters,
    toQuery,
    type FleaFilterState,
    type FleaSortKey,
} from './query';

/** Карточка выдачи: белый список полей сервера (FleaListingResource). */
export interface FleaCard {
    id: string;
    title: string;
    price: number | null;
    condition: string | null;
    city: string;
    ship: boolean;
    negotiable: boolean;
    posted: string | null;
    /** Объявление в избранном у зрителя (4.3.1). */
    favorite: boolean;
}

export interface FleaCategory {
    name: string;
    path: string;
    crumbs: { name: string; path: string }[];
}

export interface FleaIndexProps {
    listings: FleaCard[];
    pagination: { page: number; pages: number; total: number; perPage: number };
    filters: FleaFilterState;
    sorts: FleaSortKey[];
    conditions: ConditionOption[];
    category: FleaCategory | null;
    categoryCounts: Record<string, number>;
    categories: CategoryOption[];
    /** Поиск не ответил: выдача пуста не потому, что лотов нет. */
    searchError: boolean;
}

type Condition = 'new' | 'mint' | 'excellent' | 'very-good' | 'good' | 'fair' | 'poor' | 'parts';

const FILTERS_ID = 'flea-filters';

/** Порядок, в котором предлагается снять фильтр в пустой выдаче: от самого сужающего. */
const NARROWEST_FIRST = ['price', 'ship', 'negotiable', 'condition'];

/** Сколько скелетонов, если карточек на экране не было. */
const SKELETONS_BY_DEFAULT = 8;

const t = ru.flea;

const NBSP = String.fromCharCode(160);

const rub = (price: number): string => `${price.toLocaleString('ru-RU')}${NBSP}₽`;

/** Подпись чипа цены: «от 50 000 ₽», «до 90 000 ₽» или «50 000 – 90 000 ₽». */
function priceLabel(from: number | null, to: number | null): string {
    if (from !== null && to !== null) return `${from.toLocaleString('ru-RU')} – ${rub(to)}`;
    return from !== null ? t.filters.priceChipFrom(rub(from)) : t.filters.priceChipTo(rub(to ?? 0));
}

export default function FleaIndex({
    listings,
    pagination,
    filters,
    sorts,
    conditions,
    category,
    categoryCounts,
    categories,
    searchError,
}: FleaIndexProps) {
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    useScrollRestore();

    const base = category === null ? FLEA_PATH : `${FLEA_PATH}/${category.path}`;
    const categoryPath = category?.path ?? null;

    useEffect(() => {
        const offStart = router.on('start', () => setBusy(true));
        const offFinish = router.on('finish', () => setBusy(false));
        return () => {
            offStart();
            offFinish();
        };
    }, []);

    /** Смена фильтров — обычный визит: адрес и история обновляются, прокрутка и поля остаются. */
    const visit = (next: FleaFilterState) =>
        router.get(
            base,
            { ...toQuery(next) },
            { preserveScroll: true, preserveState: true, queryStringArrayFormat: 'brackets' },
        );

    const showMore = () => {
        setLoadingMore(true);
        router.get(
            base,
            { ...toQuery(filters, pagination.page + 1) },
            {
                only: ['listings', 'pagination', 'searchError'],
                preserveScroll: true,
                preserveState: true,
                replace: true,
                queryStringArrayFormat: 'brackets',
                onFinish: () => setLoadingMore(false),
            },
        );
    };

    const crumbs: Crumb[] = [
        { label: ru.breadcrumbs.home, href: '/' },
        category === null ? { label: t.title } : { label: t.title, href: FLEA_PATH },
        ...(category?.crumbs.map((crumb, index, all) =>
            index === all.length - 1
                ? { label: crumb.name }
                : { label: crumb.name, href: `${FLEA_PATH}/${crumb.path}` },
        ) ?? []),
    ];

    const active: { key: string; label: string; remove: FleaFilterState }[] = [
        ...filters.condition.map((value) => ({
            key: `condition:${value}`,
            label: conditions.find((c) => c.value === value)?.label ?? value,
            remove: { ...filters, condition: filters.condition.filter((v) => v !== value) },
        })),
        ...(filters.priceFrom !== null || filters.priceTo !== null
            ? [
                  {
                      key: 'price',
                      label: priceLabel(filters.priceFrom, filters.priceTo),
                      remove: { ...filters, priceFrom: null, priceTo: null },
                  },
              ]
            : []),
        ...(filters.negotiable
            ? [
                  {
                      key: 'negotiable',
                      label: t.filters.negotiable,
                      remove: { ...filters, negotiable: false },
                  },
              ]
            : []),
        ...(filters.ship
            ? [{ key: 'ship', label: t.filters.ship, remove: { ...filters, ship: false } }]
            : []),
    ];

    // Без запроса умолчание — «Сначала свежие» (пустое значение). С запросом умолчание — релевантность,
    // а «Сначала свежие» выбирается явно (sort=new).
    const sortOptions =
        filters.q !== ''
            ? [
                  { value: '', label: t.sort.relevance },
                  ...sorts.map((sort) => ({ value: sort, label: t.sort[sort] })),
              ]
            : [
                  { value: '', label: t.sort.new },
                  ...sorts
                      .filter((sort) => sort !== 'new')
                      .map((sort) => ({ value: sort, label: t.sort[sort] })),
              ];

    const filtered = hasActiveFilters(filters) || filters.q !== '';
    // Пусто: предлагаем снять самый узкий фильтр; без фильтров, но с запросом, — сбросить запрос.
    const narrowest = NARROWEST_FIRST.map((key) =>
        active.find((chip) => chip.key === key || chip.key.startsWith(`${key}:`)),
    ).find((chip) => chip !== undefined);
    const emptyAction = narrowest
        ? { label: t.empty.narrowest(narrowest.label), onClick: () => visit(narrowest.remove) }
        : filtered
          ? { label: t.empty.reset, onClick: () => visit(EMPTY_FILTERS) }
          : undefined;
    const loading = busy && !loadingMore;
    const skeletons = (count: number) =>
        Array.from({ length: count }, (_, i) => <FleaListingSkeleton key={i} />);
    // Повтор после сбоя «Показать ещё» перезапрашивает текущую страницу: уже загруженные карточки остаются сверху.
    const errorBlock = (
        <div className="ym-flea__error">
            <Alert tone="danger" title={t.error.title}>
                {t.error.text}
            </Alert>
            <Button variant="outline" onClick={() => router.reload()}>
                {t.error.retry}
            </Button>
        </div>
    );
    const title = category?.name ?? t.title;

    return (
        <div className="ym-flea">
            <Breadcrumbs items={crumbs} />

            <div className="ym-flea__head">
                <h1 className="h1 ym-title">{title}</h1>
                <p className="body-s ym-flea__lead">{t.lead}</p>
            </div>

            <div className="ym-flea__toggle">
                <Button
                    variant="outline"
                    block
                    icon="sliders-horizontal"
                    aria-expanded={filtersOpen}
                    aria-controls={FILTERS_ID}
                    onClick={() => setFiltersOpen((open) => !open)}
                >
                    {t.filters.toggle}
                </Button>
            </div>

            <div className="ym-flea__layout">
                <FleaFilterPanel
                    id={FILTERS_ID}
                    open={filtersOpen}
                    filters={filters}
                    conditions={conditions}
                    categories={categories}
                    categoryPath={categoryPath}
                    categoryCounts={categoryCounts}
                    onChange={visit}
                />

                <div className="ym-flea__results" aria-busy={busy}>
                    <div className="ym-flea__toolbar">
                        <div className="ym-flea__active">
                            {active.length > 0 ? (
                                <div
                                    role="group"
                                    aria-label={t.filters.active}
                                    className="ym-flea__chips"
                                >
                                    {active.map((chip) => (
                                        <FilterChip
                                            key={chip.key}
                                            selected
                                            removable
                                            onChange={() => visit(chip.remove)}
                                        >
                                            {chip.label}
                                        </FilterChip>
                                    ))}
                                </div>
                            ) : null}
                            {searchError ? null : (
                                <span className="body-s ym-flea__found">
                                    {t.found(pagination.total)}
                                </span>
                            )}
                        </div>
                        <Select
                            id="flea-sort"
                            label={t.sort.label}
                            className="ym-flea__sort"
                            options={sortOptions}
                            value={filters.sort ?? ''}
                            onChange={(value) =>
                                visit({
                                    ...filters,
                                    sort:
                                        sorts.find(
                                            (sort) =>
                                                sort === value &&
                                                (sort !== 'new' || filters.q !== ''),
                                        ) ?? null,
                                })
                            }
                        />
                    </div>

                    {listings.length === 0 ? (
                        loading ? (
                            <div className="ym-flea__grid ym-flea__grid--loading">
                                {skeletons(SKELETONS_BY_DEFAULT)}
                            </div>
                        ) : searchError ? (
                            errorBlock
                        ) : (
                            <EmptyState icon={'search' satisfies IconName} action={emptyAction}>
                                {filtered ? t.empty.filtered : t.empty.city}
                            </EmptyState>
                        )
                    ) : (
                        <>
                            {searchError && !loading ? errorBlock : null}
                            {/* Загрузка: скелетоны поверх прежних карточек, чтобы высота страницы не менялась
                                (иначе Inertia сохранит сбитую позицию прокрутки, а нижние блоки сдвинутся). */}
                            <div className="ym-flea__stack">
                                <div className="ym-flea__grid" aria-hidden={loading || undefined}>
                                    {listings.map((card) => (
                                        <PricedListingCard
                                            key={card.id}
                                            title={card.title}
                                            href={lotPath(card.id)}
                                            listingId={card.id}
                                            favorite={card.favorite}
                                            price={card.price}
                                            condition={
                                                (card.condition ?? undefined) as
                                                    Condition | undefined
                                            }
                                            city={card.city}
                                            posted={card.posted ?? undefined}
                                            delivery={card.ship ? t.shipping : undefined}
                                            safe={false}
                                        />
                                    ))}
                                </div>
                                {loading ? (
                                    <div className="ym-flea__grid ym-flea__grid--loading ym-flea__overlay">
                                        {skeletons(listings.length)}
                                    </div>
                                ) : null}
                            </div>
                        </>
                    )}

                    {pagination.page < pagination.pages ? (
                        <div className="ym-flea__more">
                            <Button variant="outline" loading={loadingMore} onClick={showMore}>
                                {t.more}
                            </Button>
                            <span className="body-s ym-flea__shown">
                                {t.shown(listings.length, pagination.total)}
                            </span>
                        </div>
                    ) : null}

                    <Pagination
                        page={pagination.page}
                        pages={pagination.pages}
                        href={(page) => fleaHref(categoryPath, filters, page)}
                    />
                </div>
            </div>
        </div>
    );
}

/** Каркас: вкладка «Поиск» нижней панели, раздел «Барахолка» в шапке, заголовок вкладки по категории. */
function FleaLayout({ children }: { children: ReactNode }) {
    const { props } = usePage<{ category?: FleaCategory | null }>();

    return (
        <PublicLayout
            title={props.category?.name ?? ru.flea.title}
            tab="search"
            active="flea"
            onSearch={(query) => {
                const q = query.trim();
                router.get(FLEA_PATH, q === '' ? {} : { q });
            }}
        >
            {children}
        </PublicLayout>
    );
}

FleaIndex.layout = (page: ReactNode) => <FleaLayout>{page}</FleaLayout>;
