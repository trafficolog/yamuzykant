import { Button, Field } from '@ds';
import { router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ru } from '@/lang/ru';

/** Город из shared prop `city` (только id и name). */
export interface CityOption {
    id: number;
    name: string;
}

/** Строка справочника из `GET /cities`. */
interface CityListItem extends CityOption {
    region: string;
}

type CityResult = { key: string; items: CityListItem[] } | { key: string; failed: true };

/** Адрес смены города (POST, CSRF по группе web) и справочника (GET, JSON). */
const CHANGE_URL = '/city';
const SEARCH_URL = '/cities';

const TOGGLE_ID = 'site-city-toggle';
const PANEL_ID = 'site-city-panel';
const SEARCH_ID = 'site-city-search';

export interface CitySelectProps {
    /** Город из shared prop; без него кнопка показывает «Москву» по умолчанию. */
    city: CityOption | null;
}

/**
 * Кнопка города в шапке и окно выбора: поиск по справочнику, список (у справочника нет отдельного
 * признака «популярный» — в нём только миллионники), смена через Inertia без перезагрузки страницы.
 * Окно — не модальное: Esc и клик вне закрывают его, фокус возвращается на кнопку.
 */
export default function CitySelect({ city }: CitySelectProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<CityResult | null>(null);
    const [saveFailed, setSaveFailed] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    const key = query.trim();
    const current = result?.key === key ? result : null;

    const close = useCallback((restoreFocus: boolean) => {
        setOpen(false);
        setQuery('');
        setSaveFailed(false);
        if (restoreFocus) document.getElementById(TOGGLE_ID)?.focus();
    }, []);

    // Справочник грузим при открытии и при каждом изменении запроса; устаревший ответ отбрасываем.
    useEffect(() => {
        if (!open) return;

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
            .then((body) => setResult({ key, items: body.data }))
            .catch(() => {
                if (!controller.signal.aborted) setResult({ key, failed: true });
            });

        return () => controller.abort();
    }, [open, key]);

    // При открытии фокус в поле поиска.
    useEffect(() => {
        if (open) document.getElementById(SEARCH_ID)?.focus();
    }, [open]);

    // Пока окно открыто: Esc закрывает с возвратом фокуса; клик и фокус вне шапочного блока закрывают.
    useEffect(() => {
        if (!open) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') close(true);
        };
        const outside = (event: Event) => {
            const target = event.target;
            if (target instanceof Node && !wrapRef.current?.contains(target)) close(false);
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('pointerdown', outside);
        document.addEventListener('focusin', outside);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('focusin', outside);
        };
    }, [open, close]);

    const choose = (item: CityOption) => {
        setSaveFailed(false);
        router.post(
            CHANGE_URL,
            { city_id: item.id },
            {
                preserveScroll: true,
                onSuccess: () => close(true),
                onError: () => setSaveFailed(true),
            },
        );
    };

    return (
        <div ref={wrapRef} className="ym-city">
            <Button
                id={TOGGLE_ID}
                variant="ghost"
                icon="map-pin"
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={open ? PANEL_ID : undefined}
                onClick={() => (open ? close(true) : setOpen(true))}
            >
                {city?.name ?? ru.header.defaultCity}
            </Button>

            {open ? (
                <div
                    id={PANEL_ID}
                    role="dialog"
                    aria-label={ru.city.label}
                    className="ym-city__panel"
                >
                    <Field
                        id={SEARCH_ID}
                        type="search"
                        label={ru.city.search}
                        value={query}
                        autoComplete="off"
                        onChange={(event) => setQuery(event.target.value)}
                    />

                    {saveFailed ? (
                        <p role="alert" className="ym-city__message type-body-s">
                            {ru.city.saveError}
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
                            <ul className="ym-city__list">
                                {current.items.map((item) => (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            className="ym-city__item"
                                            aria-current={item.id === city?.id ? 'true' : undefined}
                                            onClick={() => choose(item)}
                                        >
                                            {item.name}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            ) : null}
        </div>
    );
}
