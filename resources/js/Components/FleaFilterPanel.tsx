import { Field, FilterChip } from '@ds';
import { Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';

import { ru } from '@/lang/ru';
import { fleaHref, hasActiveFilters, type FleaFilterState } from '@/Pages/Flea/query';

export interface ConditionOption {
    value: string;
    label: string;
    count: number;
}

/** Узел дерева категорий из shared prop `categories` (CategoryResource). */
export interface CategoryOption {
    id: number;
    name: string;
    slug: string;
    icon: string | null;
    children: CategoryOption[];
}

export interface FleaFilterPanelProps {
    id: string;
    open: boolean;
    filters: FleaFilterState;
    conditions: readonly ConditionOption[];
    categories: readonly CategoryOption[];
    /** Путь выбранной категории (`gitary/elektrogitary`). */
    categoryPath: string | null;
    categoryCounts: Record<string, number>;
    onChange: (next: FleaFilterState) => void;
}

const t = ru.flea.filters;

/** Из текста поля — целые рубли; пустое поле или нет цифр — границы нет. */
function parsePrice(text: string): number | null {
    const digits = text.replace(/\D/g, '');
    return digits === '' ? null : Number(digits);
}

/** Поле цены: текст хранит панель, чтобы оба поля попадали в адрес вместе. */
function PriceField({
    id,
    label,
    placeholder,
    text,
    onText,
    onCommit,
}: {
    id: string;
    label: string;
    placeholder: string;
    text: string;
    onText: (text: string) => void;
    onCommit: () => void;
}) {
    return (
        <Field
            id={id}
            label={label}
            suffix={t.currency}
            placeholder={placeholder}
            inputMode="numeric"
            autoComplete="off"
            value={text}
            onChange={(event) => onText(event.target.value)}
            onBlur={onCommit}
            onKeyDown={(event) => {
                if (event.key === 'Enter') onCommit();
            }}
        />
    );
}

/** Ветка категорий: корни, а у выбранной ветки — её потомки. Ссылки сохраняют фильтры, страница сбрасывается. */
function CategoryList({
    nodes,
    parent,
    current,
    counts,
    filters,
}: {
    nodes: readonly CategoryOption[];
    parent: string | null;
    current: string | null;
    counts: Record<string, number>;
    filters: FleaFilterState;
}) {
    return (
        <ul className="ym-flea__cats">
            {nodes.map((node) => {
                const path = parent === null ? node.slug : `${parent}/${node.slug}`;
                const isCurrent = path === current;
                const inBranch =
                    current !== null && (current === path || current.startsWith(`${path}/`));
                const count = counts[path];

                return (
                    <li key={node.id}>
                        <Link
                            href={fleaHref(path, filters)}
                            className="ym-flea__cat"
                            aria-current={isCurrent ? 'page' : undefined}
                        >
                            <span>{node.name}</span>
                            {count !== undefined ? (
                                <span className="ym-flea__count">{count}</span>
                            ) : null}
                        </Link>
                        {inBranch && node.children.length > 0 ? (
                            <CategoryList
                                nodes={node.children}
                                parent={path}
                                current={current}
                                counts={counts}
                                filters={filters}
                            />
                        ) : null}
                    </li>
                );
            })}
        </ul>
    );
}

/** Панель фильтров Барахолки (UC-S3): категория, состояние, цена, «Готов к торгу», доставка. */
export default function FleaFilterPanel({
    id,
    open,
    filters,
    conditions,
    categories,
    categoryPath,
    categoryCounts,
    onChange,
}: FleaFilterPanelProps) {
    const [fromText, setFromText] = useState(
        filters.priceFrom === null ? '' : String(filters.priceFrom),
    );
    const [toText, setToText] = useState(filters.priceTo === null ? '' : String(filters.priceTo));

    // Назад в браузере меняет адрес под полями: показываем значения из адреса.
    useEffect(
        () => setFromText(filters.priceFrom === null ? '' : String(filters.priceFrom)),
        [filters.priceFrom],
    );
    useEffect(
        () => setToText(filters.priceTo === null ? '' : String(filters.priceTo)),
        [filters.priceTo],
    );

    /** Обе границы из полей: быстрый ввод во втором поле не теряет первое. */
    const commitPrice = () => {
        const priceFrom = parsePrice(fromText);
        const priceTo = parsePrice(toText);
        if (priceFrom !== filters.priceFrom || priceTo !== filters.priceTo) {
            onChange({ ...filters, priceFrom, priceTo });
        }
    };

    const toggleCondition = (value: string, on: boolean) =>
        onChange({
            ...filters,
            condition: on
                ? conditions
                      .map((c) => c.value)
                      .filter((v) => v === value || filters.condition.includes(v))
                : filters.condition.filter((v) => v !== value),
        });

    return (
        <aside
            id={id}
            aria-label={t.title}
            className={open ? 'ym-flea__filters is-open' : 'ym-flea__filters'}
        >
            <div className="ym-flea__filters-head">
                <h2 className="h3">{t.title}</h2>
                {hasActiveFilters(filters) ? (
                    <button
                        type="button"
                        className="ym-flea__reset label"
                        onClick={() =>
                            onChange({
                                ...filters,
                                condition: [],
                                priceFrom: null,
                                priceTo: null,
                                negotiable: false,
                                ship: false,
                            })
                        }
                    >
                        {t.reset}
                    </button>
                ) : null}
            </div>

            <nav aria-label={t.category} className="ym-flea__group">
                <span className="label ym-flea__legend">{t.category}</span>
                <Link
                    href={fleaHref(null, filters)}
                    className="ym-flea__cat"
                    aria-current={categoryPath === null ? 'page' : undefined}
                >
                    {t.allCategories}
                </Link>
                <CategoryList
                    nodes={categories}
                    parent={null}
                    current={categoryPath}
                    counts={categoryCounts}
                    filters={filters}
                />
            </nav>

            <fieldset className="ym-flea__group">
                <legend className="label ym-flea__legend">{t.condition}</legend>
                <div className="ym-flea__chips">
                    {conditions.map((condition) => {
                        const selected = filters.condition.includes(condition.value);
                        return (
                            <FilterChip
                                key={condition.value}
                                selected={selected}
                                count={condition.count}
                                disabled={condition.count === 0 && !selected}
                                onChange={(on) => toggleCondition(condition.value, on)}
                            >
                                {condition.label}
                            </FilterChip>
                        );
                    })}
                </div>
            </fieldset>

            <fieldset className="ym-flea__group">
                <legend className="label ym-flea__legend">{t.price}</legend>
                <div className="ym-flea__price">
                    <PriceField
                        id={`${id}-price-from`}
                        label={t.priceFrom}
                        placeholder={t.priceFromPlaceholder}
                        text={fromText}
                        onText={setFromText}
                        onCommit={commitPrice}
                    />
                    <PriceField
                        id={`${id}-price-to`}
                        label={t.priceTo}
                        placeholder={t.priceToPlaceholder}
                        text={toText}
                        onText={setToText}
                        onCommit={commitPrice}
                    />
                </div>
            </fieldset>

            <fieldset className="ym-flea__group">
                <legend className="label ym-flea__legend">{t.deal}</legend>
                <div className="ym-flea__chips">
                    <FilterChip
                        selected={filters.negotiable}
                        onChange={(negotiable) => onChange({ ...filters, negotiable })}
                    >
                        {t.negotiable}
                    </FilterChip>
                    <FilterChip
                        selected={filters.ship}
                        icon="truck"
                        onChange={(ship) => onChange({ ...filters, ship })}
                    >
                        {t.ship}
                    </FilterChip>
                </div>
            </fieldset>
        </aside>
    );
}
