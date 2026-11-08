import { Icon } from '@ds';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ru } from '@/lang/ru';

export interface LotPhoto {
    id: number;
    is_serial: boolean;
    urls: Record<string, Record<string, string>>;
}

export interface LotGalleryProps {
    photos: readonly LotPhoto[];
    title: string;
}

const t = ru.lot.gallery;

/** Tab по кругу внутри диалога. */
function trapTab(event: globalThis.KeyboardEvent, root: HTMLElement | null): void {
    const items = Array.from(root?.querySelectorAll<HTMLElement>('button') ?? []);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

/** Версия фото в двух форматах: AVIF и WebP (резерв — `img`). */
function Picture({
    photo,
    variant,
    alt,
    className,
    eager = false,
}: {
    photo: LotPhoto;
    variant: 'wide' | 'square';
    alt: string;
    className?: string;
    eager?: boolean;
}) {
    const urls = photo.urls[variant] ?? {};
    return (
        <picture>
            {urls.avif ? <source type="image/avif" srcSet={urls.avif} /> : null}
            {urls.webp ? <source type="image/webp" srcSet={urls.webp} /> : null}
            <img
                className={className}
                src={urls.webp ?? urls.avif}
                alt={alt}
                loading={eager ? 'eager' : 'lazy'}
                decoding="async"
            />
        </picture>
    );
}

/**
 * Галерея лота: фото 4:3, счётчик, превью, просмотр на весь экран (диалог: стрелки, Escape, фокус возвращается).
 * Фото серийного номера приходит только владельцу и сотрудникам и стоит последним (сервер).
 */
export default function LotGallery({ photos, title }: LotGalleryProps) {
    const [index, setIndex] = useState(0);
    const [open, setOpen] = useState(false);
    const opener = useRef<HTMLButtonElement>(null);
    const total = photos.length;
    const current = photos[Math.min(index, Math.max(0, total - 1))];

    const step = useCallback(
        (delta: number) => setIndex((value) => (value + delta + total) % total),
        [total],
    );

    const close = useCallback(() => {
        setOpen(false);
        opener.current?.focus();
    }, []);

    if (current === undefined) {
        return (
            <section aria-label={t.label} className="ym-lot__gallery">
                <div className="ym-lot__stage ym-lot__stage--empty">
                    <Icon name="camera" size={64} />
                    <span className="body-s">{t.empty}</span>
                </div>
            </section>
        );
    }

    const alt = (photo: LotPhoto, position: number) =>
        photo.is_serial ? ru.photos.serialAlt : t.alt(position + 1, title);

    return (
        <section aria-label={t.label} className="ym-lot__gallery">
            <div className="ym-lot__stage">
                <button
                    ref={opener}
                    type="button"
                    className="ym-lot__open"
                    aria-label={t.open}
                    onClick={() => setOpen(true)}
                >
                    <Picture
                        photo={current}
                        variant="wide"
                        alt={alt(current, index)}
                        className="ym-lot__photo"
                        eager
                    />
                </button>
                <span className="ym-lot__count body-s" aria-hidden="true">
                    {t.counter(index + 1, total)}
                </span>
                <span className="ym-sr" role="status">
                    {t.counter(index + 1, total)}
                </span>
            </div>

            {total > 1 ? (
                <div role="group" aria-label={t.choose} className="ym-lot__thumbs">
                    {photos.map((photo, position) => (
                        <button
                            key={photo.id}
                            type="button"
                            className="ym-lot__thumb"
                            aria-label={
                                photo.is_serial
                                    ? t.serialPhoto(position + 1)
                                    : t.photo(position + 1)
                            }
                            aria-pressed={position === index}
                            onClick={() => setIndex(position)}
                        >
                            <Picture photo={photo} variant="square" alt="" />
                        </button>
                    ))}
                </div>
            ) : null}
            {current.is_serial ? <p className="body-s ym-lot__note">{t.serialNote}</p> : null}

            {open ? (
                <Viewer photos={photos} index={index} title={title} onStep={step} onClose={close} />
            ) : null}
        </section>
    );
}

interface ViewerProps {
    photos: readonly LotPhoto[];
    index: number;
    title: string;
    onStep: (delta: number) => void;
    onClose: () => void;
}

/** Просмотр на весь экран: модальный диалог, фокус внутри (Tab по кругу), прокрутка страницы заблокирована. */
function Viewer({ photos, index, title, onStep, onClose }: ViewerProps) {
    const root = useRef<HTMLDivElement>(null);
    const closeButton = useRef<HTMLButtonElement>(null);
    const photo = photos[index];

    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        closeButton.current?.focus();
        return () => {
            document.body.style.overflow = previous;
        };
    }, []);

    // Клавиши — на документе: фокус внутри диалога, но слушатель не должен висеть на неинтерактивном элементе.
    const count = photos.length;
    useEffect(() => {
        const handler = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
            else if (event.key === 'ArrowRight' && count > 1) onStep(1);
            else if (event.key === 'ArrowLeft' && count > 1) onStep(-1);
            else if (event.key === 'Tab') trapTab(event, root.current);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [count, onClose, onStep]);

    if (photo === undefined || typeof document === 'undefined') return null;

    return createPortal(
        <div
            ref={root}
            className="ym-root ym-lot__viewer"
            role="dialog"
            aria-modal="true"
            aria-label={t.viewer}
        >
            <button
                ref={closeButton}
                type="button"
                className="ym-lot__viewer-close ym-iconbtn"
                aria-label={t.close}
                onClick={onClose}
            >
                <Icon name="x" size={24} />
            </button>
            <div className="ym-lot__viewer-stage">
                {photos.length > 1 ? (
                    <button
                        type="button"
                        className="ym-lot__viewer-nav ym-lot__viewer-nav--prev ym-iconbtn"
                        aria-label={t.prev}
                        onClick={() => onStep(-1)}
                    >
                        <Icon name="chevron-right" size={24} />
                    </button>
                ) : null}
                <Picture
                    photo={photo}
                    variant="wide"
                    alt={photo.is_serial ? ru.photos.serialAlt : t.alt(index + 1, title)}
                    className="ym-lot__viewer-photo"
                    eager
                />
                {photos.length > 1 ? (
                    <button
                        type="button"
                        className="ym-lot__viewer-nav ym-lot__viewer-nav--next ym-iconbtn"
                        aria-label={t.next}
                        onClick={() => onStep(1)}
                    >
                        <Icon name="chevron-right" size={24} />
                    </button>
                ) : null}
            </div>
            <p className="ym-lot__viewer-count body-s" aria-live="polite">
                {t.counter(index + 1, photos.length)}
            </p>
        </div>,
        document.body,
    );
}
