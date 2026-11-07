import { Field } from '@ds';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { ru } from '@/lang/ru';

/** Модель из справочника, как её отдаёт GET /api/models (InstrumentModelResource). */
export interface ModelOption {
    id: number;
    brand: string;
    name: string;
    year_from: number | null;
    year_to: number | null;
    category_id: number;
}

interface ModelComboboxProps {
    id: string;
    /** Текст поля извне (например, черновик объявления). */
    value: string;
    /** Любое изменение текста, в том числе ввод без выбора из подсказки. */
    onChange: (text: string) => void;
    /** Выбор модели из списка. */
    onSelect: (model: ModelOption) => void;
    /** Ошибка поля (например, ответ сервера): показывается вместо подсказки. */
    error?: string;
}

type Failure = 'network' | 'limited';

class RateLimitedError extends Error {}

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;

/**
 * Поле «Бренд и модель» с подсказкой из справочника (UC-L1, п. 2). Клавиатура: стрелки, Enter, Escape.
 * Ввод без выбора не теряется: текст уходит через onChange, модель создаётся на сервере как suggested.
 */
export function ModelCombobox({ id, value, onChange, onSelect, error }: ModelComboboxProps) {
    const [text, setText] = useState(value);
    const [results, setResults] = useState<ModelOption[]>([]);
    const [searched, setSearched] = useState(false);
    const [failure, setFailure] = useState<Failure | null>(null);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    // Текст, который записан выбором из списка: по нему подсказку повторно не запрашиваем.
    const chosenText = useRef<string | null>(null);
    // Номер последнего запроса: ответ на более ранний запрос не перетирает результаты нового.
    const latestRequest = useRef(0);

    useEffect(() => {
        setText(value);
    }, [value]);

    useEffect(() => {
        if (chosenText.current === text) {
            return;
        }
        const query = text.trim();
        if (query.length < MIN_QUERY_LENGTH) {
            latestRequest.current += 1;
            setResults([]);
            setSearched(false);
            setFailure(null);

            return;
        }

        const requestId = ++latestRequest.current;
        const controller = new AbortController();
        const isStale = () => requestId !== latestRequest.current;

        const timer = window.setTimeout(() => {
            fetch(`/api/models?q=${encodeURIComponent(query)}`, {
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            })
                .then((response) => {
                    if (response.status === 429) {
                        throw new RateLimitedError();
                    }
                    if (!response.ok) {
                        throw new Error(String(response.status));
                    }

                    return response.json() as Promise<{ data: ModelOption[] }>;
                })
                .then((json) => {
                    if (isStale()) {
                        return;
                    }
                    setResults(json.data);
                    setSearched(true);
                    setFailure(null);
                    setActive(-1);
                    setOpen(true);
                })
                .catch((error: unknown) => {
                    if (isStale() || controller.signal.aborted) {
                        return;
                    }
                    setResults([]);
                    setSearched(true);
                    setFailure(error instanceof RateLimitedError ? 'limited' : 'network');
                });
        }, DEBOUNCE_MS);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [text]);

    const listId = `${id}-listbox`;
    const optionId = (index: number) => `${id}-option-${index}`;
    const showList = open && results.length > 0;

    function handleChange(next: string) {
        chosenText.current = null;
        setText(next);
        setActive(-1);
        onChange(next);
    }

    function choose(model: ModelOption) {
        const label = `${model.brand} ${model.name}`;
        chosenText.current = label;
        setText(label);
        setOpen(false);
        setActive(-1);
        onChange(label);
        onSelect(model);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (results.length === 0) {
                return;
            }
            event.preventDefault();
            setOpen(true);
            setActive((current) =>
                event.key === 'ArrowDown'
                    ? Math.min(current + 1, results.length - 1)
                    : Math.max(current - 1, 0),
            );
        } else if (event.key === 'Enter') {
            const highlighted = results[active];
            if (showList && highlighted) {
                event.preventDefault();
                choose(highlighted);
            }
        } else if (event.key === 'Escape') {
            if (showList) {
                event.preventDefault();
                setOpen(false);
                setActive(-1);
            }
        }
    }

    const hasQuery = text.trim().length >= MIN_QUERY_LENGTH;
    let hint: string = ru.models.hint;
    if (failure === 'limited') {
        hint = ru.models.errorLimited;
    } else if (failure === 'network') {
        hint = ru.models.errorNetwork;
    } else if (searched && results.length === 0 && hasQuery) {
        hint = ru.models.empty;
    }

    let status = '';
    if (failure === null && searched && hasQuery) {
        status = results.length > 0 ? ru.models.found(results.length) : ru.models.notFound;
    }

    return (
        <div className="ym-combobox">
            <Field
                id={id}
                label={ru.models.label}
                placeholder={ru.models.placeholder}
                hint={hint}
                error={error}
                value={text}
                onChange={(event) => handleChange(event.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => setOpen(false)}
                role="combobox"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={showList}
                aria-controls={showList ? listId : undefined}
                aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
            />
            <p role="status" className="ym-combobox__status">
                {status}
            </p>
            {showList ? (
                <ul
                    id={listId}
                    role="listbox"
                    aria-label={ru.models.listLabel}
                    className="ym-combobox__list"
                >
                    {results.map((model, index) => (
                        <li
                            key={model.id}
                            id={optionId(index)}
                            role="option"
                            aria-selected={index === active}
                            className={
                                index === active
                                    ? 'ym-combobox__option is-active'
                                    : 'ym-combobox__option'
                            }
                            // mousedown до blur: клик по варианту не закрывает список раньше выбора.
                            onMouseDown={(event) => {
                                event.preventDefault();
                                choose(model);
                            }}
                        >
                            {model.brand} {model.name}
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
