import { Field } from '@ds';
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useState } from 'react';

import { ru } from '@/lang/ru';

/** Город из shared prop `city` (только id и name). */
export interface CityOption {
    id: number;
    name: string;
}

/** Строка справочника из `GET /cities`. */
export interface CityListItem extends CityOption {
    region: string;
    /** Тип населённого пункта: «г.», «пос.», «д.» — перед названием в тексте. */
    type?: string;
}

type CityResult = { key: string; items: CityListItem[] } | { key: string; failed: true };

/** Справочник для окна выбора (GET, JSON). */
const SEARCH_URL = '/cities';

/** Ответы справочника по запросу на время жизни страницы: повторное открытие панели не грузит их заново. */
const cache = new Map<string, CityListItem[]>();

/** Сбросить кэш справочника (тесты). */
export function resetCityCache(): void {
    cache.clear();
}

export interface CityPickerProps {
    /** id поля поиска; от него строятся id списка (`{searchId}-list`). */
    searchId: string;
    /** Выбранный сейчас город — помечается `aria-current`. */
    selectedId?: number;
    onChoose: (city: CityListItem) => void;
    /** Сообщение об ошибке выбора (например, не удалось сохранить) над списком. */
    notice?: string | null;
}

/**
 * Поиск по справочнику городов и список: общая часть окна выбора в шапке (CitySelect, 1.1.4)
 * и шага «Первый вход» окна входа (LoginDialog, 1.1.2). Справочник грузится при монтировании и при
 * каждом изменении запроса, устаревший ответ отбрасывается. У справочника нет признака «популярный» —
 * в нём только миллионники. Что делать с выбором — решает родитель (onChoose).
 */
export default function CityPicker({ searchId, selectedId, onChoose, notice }: CityPickerProps) {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<CityResult | null>(null);

    const listId = `${searchId}-list`;
    const key = query.trim();
    const cached = cache.get(key);
    const current: CityResult | null = cached
        ? { key, items: cached }
        : result?.key === key
          ? result
          : null;

    useEffect(() => {
        if (cache.has(key)) return;

        const controller = new AbortController();
        const url = key === '' ? SEARCH_URL : `${SEARCH_URL}?${new URLSearchParams({ q: key })}`;

        Promise.resolve()
            .then(() =>
                fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal }),
            )
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json() as Promise<{ data: CityListItem[] }>;
            })
            .then((body) => {
                cache.set(key, body.data);
                setResult({ key, items: body.data });
            })
            .catch(() => {
                if (!controller.signal.aborted) setResult({ key, failed: true });
            });

        return () => controller.abort();
    }, [key]);

    const focusItem = (index: number) => {
        const items = document.querySelectorAll<HTMLButtonElement>(`#${listId} .ym-city__item`);
        items[Math.min(Math.max(index, 0), items.length - 1)]?.focus();
    };

    // Стрелки вверх и вниз переводят фокус по списку; Home и End — к первому и последнему городу.
    const onItemKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
        const last = document.querySelectorAll(`#${listId} .ym-city__item`).length - 1;

        if (event.key === 'ArrowDown') focusItem(index + 1);
        else if (event.key === 'ArrowUp') focusItem(index - 1);
        else if (event.key === 'Home') focusItem(0);
        else if (event.key === 'End') focusItem(last);
        else return;
        event.preventDefault();
    };

    return (
        <>
            <Field
                id={searchId}
                type="search"
                label={ru.city.search}
                value={query}
                autoComplete="off"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                    // Вниз из поля поиска — к первому городу списка.
                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        focusItem(0);
                    }
                }}
            />

            {notice ? (
                <p role="alert" className="ym-city__message type-body-s">
                    {notice}
                </p>
            ) : null}

            {current === null ? (
                <p role="status" className="ym-city__message type-body-s">
                    {ru.city.loading}
                </p>
            ) : 'failed' in current ? (
                <p role="alert" className="ym-city__message type-body-s">
                    {ru.city.loadError}
                </p>
            ) : current.items.length === 0 ? (
                <p role="status" className="ym-city__message type-body-s">
                    {ru.city.empty}
                </p>
            ) : (
                <>
                    <p className="ym-city__caption type-body-s">
                        {key === '' ? ru.city.popular : ru.city.found}
                    </p>
                    <ul id={listId} className="ym-city__list">
                        {current.items.map((item, index) => (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    className="ym-city__item"
                                    aria-current={item.id === selectedId ? 'true' : undefined}
                                    onClick={() => onChoose(item)}
                                    onKeyDown={(event) => onItemKeyDown(event, index)}
                                >
                                    {item.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </>
    );
}
