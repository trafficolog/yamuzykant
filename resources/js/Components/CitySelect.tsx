import { Button } from '@ds';
import { router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import CityPicker, { type CityOption } from '@/Components/CityPicker';
import { ru } from '@/lang/ru';

export type { CityOption };

/** Адрес смены города (POST, CSRF по группе web). */
const CHANGE_URL = '/city';

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
    const [saveFailed, setSaveFailed] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    const close = useCallback((restoreFocus: boolean) => {
        setOpen(false);
        setSaveFailed(false);
        if (restoreFocus) document.getElementById(TOGGLE_ID)?.focus();
    }, []);

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
                    <div className="ym-city__head">
                        <p className="ym-city__title type-h3">{ru.city.label}</p>
                        <Button
                            variant="ghost"
                            icon="x"
                            aria-label={ru.city.close}
                            onClick={() => close(true)}
                        />
                    </div>

                    <CityPicker
                        searchId={SEARCH_ID}
                        selectedId={city?.id}
                        onChoose={choose}
                        notice={saveFailed ? ru.city.saveError : null}
                    />
                </div>
            ) : null}
        </div>
    );
}
