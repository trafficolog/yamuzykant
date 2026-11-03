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
}

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 200;

/**
 * Поле «Бренд и модель» с подсказкой из справочника (UC-L1, п. 2). Клавиатура: стрелки, Enter, Escape.
 * Ввод без выбора не теряется: текст уходит через onChange, модель создаётся на сервере как suggested.
 */
export function ModelCombobox({ id, value, onChange, onSelect }: ModelComboboxProps) {
    const [text, setText] = useState(value);
    const [results, setResults] = useState<ModelOption[]>([]);
    const [searched, setSearched] = useState(false);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    // Текст, который записан выбором из списка: по нему подсказку повторно не запрашиваем.
    const chosenText = useRef<string | null>(null);

    useEffect(() => {
        setText(value);
    }, [value]);

    useEffect(() => {
        if (chosenText.current === text) {
            return;
        }
        const query = text.trim();
        if (query.length < MIN_QUERY_LENGTH) {
            setResults([]);
            setSearched(false);

            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            fetch(`/api/models?q=${encodeURIComponent(query)}`, {
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            })
                .then((response) =>
                    response.ok
                        ? response.json()
                        : Promise.reject(new Error(String(response.status))),
                )
                .then((json: { data: ModelOption[] }) => {
                    setResults(json.data);
                    setSearched(true);
                    setActive(-1);
                    setOpen(true);
                })
                .catch(() => {
                    if (!controller.signal.aborted) {
                        setResults([]);
                        setSearched(true);
                    }
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

    const hint =
        searched && results.length === 0 && text.trim().length >= MIN_QUERY_LENGTH
            ? ru.models.empty
            : ru.models.hint;

    return (
        <div className="ym-combobox">
            <Field
                id={id}
                label={ru.models.label}
                placeholder={ru.models.placeholder}
                hint={hint}
                value={text}
                onChange={(event) => handleChange(event.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => setOpen(false)}
                role="combobox"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={showList}
                aria-controls={listId}
                aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
            />
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
