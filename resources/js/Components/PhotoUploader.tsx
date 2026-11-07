import { Button, Icon } from '@ds';
import type { IconName } from '@ds';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';

import {
    ACCEPTED_TYPES,
    MAX_BYTES,
    PhotoApiError,
    contentTypeOf,
    photoApi,
} from '@/Components/photoUploaderApi';
import type { ListingPhoto, PhotoApi } from '@/Components/photoUploaderApi';
import { ru } from '@/lang/ru';

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 12;
const SLOT_COUNT = 6;
const SLOT_ICONS: IconName[] = ['scan-barcode', 'guitar', 'camera', 'camera', 'camera', 'package'];
const DRAG_TYPE = 'application/x-ym-photo';

interface PhotoUploaderProps {
    listingId: string;
    initialPhotos?: ListingPhoto[];
    /** Подмена сервера в тестах. */
    api?: PhotoApi;
    /** Как часто спрашивать сервер, готовы ли фото в обработке, мс. */
    pollInterval?: number;
    onChange?: (photos: ListingPhoto[]) => void;
}

interface Upload {
    key: string;
    serial: boolean;
    /** null — ждёт очереди. */
    progress: number | null;
    error: string | null;
}

type Cell =
    | { kind: 'photo'; photo: ListingPhoto; number: number; index: number }
    | { kind: 'upload'; upload: Upload }
    | { kind: 'slot'; serial: boolean; label: string; icon: IconName };

type Direction = 'left' | 'right';

/** Серийное фото первым, затем по порядку. */
function sortPhotos(photos: ListingPhoto[]): ListingPhoto[] {
    return [...photos].sort(
        (a, b) => Number(b.is_serial) - Number(a.is_serial) || a.position - b.position,
    );
}

function validate(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(contentTypeOf(file))) return ru.photos.errors.type;
    if (file.size > MAX_BYTES) return ru.photos.errors.size;
    return null;
}

let uploadSeq = 0;

/**
 * Фото объявления (UC-L1 п. 4, BR-03): 6 ячеек из макета «Продать», первая — серийный номер («обязательно»),
 * после шести — «Ещё фото» до 12. Загрузка прямо в хранилище по подписанному URL с прогрессом, обработка
 * на сервере (опрос до готовности), удаление, порядок — перетаскиванием или кнопками сдвига с клавиатуры.
 *
 * Ячейки — свои <button>: плитки 1:1 из макета, такого компонента в ДС нет; стили — токены ДС.
 */
export default function PhotoUploader({
    listingId,
    initialPhotos = [],
    api = photoApi,
    pollInterval = 1500,
    onChange,
}: PhotoUploaderProps) {
    const [photos, setPhotos] = useState<ListingPhoto[]>(() => sortPhotos(initialPhotos));
    const [uploads, setUploads] = useState<Upload[]>([]);
    const [pollTick, setPollTick] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const pickSerial = useRef(false);
    const dragging = useRef<number | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const pendingFocus = useRef<{ id: number; direction: Direction } | null>(null);
    // После удаления: фото, на чью кнопку «Удалить» перевести фокус (null — на первую кнопку добавления).
    const focusAfterRemove = useRef<{ id: number | null } | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    // Текущие значения для подсчёта свободных мест между рендерами (несколько файлов подряд).
    const photosRef = useRef(photos);
    const uploadsRef = useRef(uploads);
    photosRef.current = photos;
    uploadsRef.current = uploads;

    useEffect(() => {
        onChange?.(photos);
    }, [photos, onChange]);

    // Фото в обработке: спрашиваем сервер, пока все не станут готовы или не получат ошибку.
    useEffect(() => {
        if (!photos.some((photo) => photo.state === 'processing')) return undefined;
        const timer = window.setTimeout(() => {
            api.list(listingId)
                .then((list) => setPhotos(sortPhotos(list)))
                .catch(() => setPollTick((tick) => tick + 1));
        }, pollInterval);
        return () => window.clearTimeout(timer);
    }, [photos, pollTick, api, listingId, pollInterval]);

    // Кнопка сдвига сохраняет фокус на том же фото после перестановки.
    useEffect(() => {
        const request = pendingFocus.current;
        if (!request) return;
        const other: Direction = request.direction === 'left' ? 'right' : 'left';
        const find = (direction: Direction) =>
            rootRef.current?.querySelector<HTMLButtonElement>(
                `[data-move="${request.id}:${direction}"]`,
            );
        (find(request.direction) ?? find(other))?.focus();
        pendingFocus.current = null;
    }, [photos]);

    // Удалённое фото уносит фокус с собой: переводим его на соседнее фото или на кнопку добавления.
    useEffect(() => {
        const request = focusAfterRemove.current;
        if (!request) return;
        focusAfterRemove.current = null;
        const root = rootRef.current;
        const target =
            request.id === null
                ? root?.querySelector<HTMLButtonElement>('.ym-photos__slot')
                : root?.querySelector<HTMLButtonElement>(`[data-remove="${request.id}"]`);
        target?.focus();
    }, [photos]);

    const patchUpload = (key: string, patch: Partial<Upload>) =>
        setUploads((list) =>
            list.map((upload) => (upload.key === key ? { ...upload, ...patch } : upload)),
        );

    const uploadOne = async (upload: Upload, file: File) => {
        try {
            const ticket = await api.requestUpload(listingId, file);
            patchUpload(upload.key, { progress: 0 });
            await api.put(ticket, file, (progress) => patchUpload(upload.key, { progress }));
            const photo = await api.confirm(listingId, ticket.upload_id, upload.serial);
            setPhotos((list) => sortPhotos([...list.filter((p) => p.id !== photo.id), photo]));
            setUploads((list) => list.filter((item) => item.key !== upload.key));
        } catch (error: unknown) {
            patchUpload(upload.key, {
                error: error instanceof PhotoApiError ? error.message : ru.photos.errors.network,
            });
        }
    };

    const uploadFiles = async (files: File[], serial: boolean) => {
        const used =
            photosRef.current.length +
            uploadsRef.current.filter((upload) => upload.error === null).length;
        const chosen = files.slice(0, serial ? 1 : Math.max(0, MAX_PHOTOS - used));
        const entries = chosen.map((file) => ({
            file,
            upload: {
                key: `upload-${(uploadSeq += 1)}`,
                serial,
                progress: null,
                error: validate(file),
            },
        }));
        setUploads((list) => [...list, ...entries.map((entry) => entry.upload)]);
        for (const entry of entries) {
            if (entry.upload.error === null) {
                await uploadOne(entry.upload, entry.file);
            }
        }
    };

    const openPicker = (serial: boolean) => {
        pickSerial.current = serial;
        if (inputRef.current) {
            inputRef.current.multiple = !serial;
            inputRef.current.click();
        }
    };

    const remove = (photo: ListingPhoto) => {
        const index = photos.findIndex((item) => item.id === photo.id);
        api.remove(listingId, photo.id)
            .then((list) => {
                const next = sortPhotos(list);
                const neighbour = next[index] ?? next[index - 1];
                focusAfterRemove.current = { id: neighbour ? neighbour.id : null };
                setActionError(null);
                setPhotos(next);
            })
            .catch((error: unknown) =>
                setActionError(
                    error instanceof PhotoApiError ? error.message : ru.photos.errors.network,
                ),
            );
    };

    const serialPhoto = photos.find((photo) => photo.is_serial);
    const others = photos.filter((photo) => !photo.is_serial);

    const move = useCallback(
        (id: number, toIndex: number, direction?: Direction) => {
            const rest = others.filter((photo) => photo.id !== id);
            const moved = others.find((photo) => photo.id === id);
            if (!moved) return;
            rest.splice(Math.max(0, Math.min(toIndex, rest.length)), 0, moved);
            const ordered = [...(serialPhoto ? [serialPhoto] : []), ...rest];
            if (direction) pendingFocus.current = { id, direction };
            setPhotos(ordered.map((photo, position) => ({ ...photo, position })));
            api.reorder(
                listingId,
                ordered.map((photo) => photo.id),
            )
                .then((list) => {
                    if (direction) pendingFocus.current = { id, direction };
                    setPhotos(sortPhotos(list));
                })
                .catch(() => api.list(listingId).then((list) => setPhotos(sortPhotos(list))));
        },
        [others, serialPhoto, api, listingId],
    );

    // Ячейки: серийный номер, остальные фото и загрузки, пустые ячейки макета, «Ещё фото».
    const cells: Cell[] = [];
    const serialUpload = uploads.find((upload) => upload.serial);
    if (serialPhoto) {
        cells.push({ kind: 'photo', photo: serialPhoto, number: 1, index: -1 });
    } else if (serialUpload) {
        cells.push({ kind: 'upload', upload: serialUpload });
    } else {
        cells.push({
            kind: 'slot',
            serial: true,
            label: ru.photos.slots[0],
            icon: SLOT_ICONS[0] ?? 'camera',
        });
    }
    others.forEach((photo, index) =>
        cells.push({ kind: 'photo', photo, number: index + (serialPhoto ? 2 : 1), index }),
    );
    uploads
        .filter((upload) => !upload.serial)
        .forEach((upload) => cells.push({ kind: 'upload', upload }));
    while (cells.length < SLOT_COUNT) {
        const slot = cells.length;
        cells.push({
            kind: 'slot',
            serial: false,
            label: ru.photos.slots[slot] ?? '',
            icon: SLOT_ICONS[slot] ?? 'camera',
        });
    }
    const used = photos.length + uploads.filter((upload) => upload.error === null).length;
    if (used < MAX_PHOTOS && cells.every((cell) => cell.kind !== 'slot' || cell.serial)) {
        cells.push({ kind: 'slot', serial: false, label: ru.photos.extraSlot, icon: 'plus' });
    }

    const counted = photos.filter((photo) => photo.state !== 'failed');
    const missing: string[] = [];
    if (counted.length < MIN_PHOTOS) missing.push(ru.photos.more(MIN_PHOTOS - counted.length));
    if (!counted.some((photo) => photo.is_serial)) missing.push(ru.photos.serialMissing);

    const handleDrop = (event: DragEvent<HTMLLIElement>, cell: Cell) => {
        event.preventDefault();
        const transfer = event.dataTransfer;
        const raw = typeof transfer?.getData === 'function' ? transfer.getData(DRAG_TYPE) : '';
        const draggedId = raw !== '' ? Number(raw) : dragging.current;
        dragging.current = null;
        if (draggedId !== null && cell.kind === 'photo' && !cell.photo.is_serial) {
            if (draggedId !== cell.photo.id) move(draggedId, cell.index);
            return;
        }
        const files = Array.from(transfer?.files ?? []);
        if (files.length > 0 && cell.kind === 'slot') {
            void uploadFiles(files, cell.serial);
        }
    };

    const renderCell = (cell: Cell) => {
        if (cell.kind === 'slot') {
            const hintId = cell.serial ? `${listingId}-serial-required` : undefined;
            return (
                <button
                    type="button"
                    className="ym-photos__slot"
                    aria-label={ru.photos.add(cell.label)}
                    aria-describedby={hintId}
                    onClick={() => openPicker(cell.serial)}
                >
                    <Icon name={cell.icon} size={28} />
                    <span className="type-body-s ym-photos__label">{cell.label}</span>
                    {cell.serial ? (
                        <span id={hintId} className="type-caption ym-photos__required">
                            {ru.photos.required}
                        </span>
                    ) : null}
                </button>
            );
        }

        if (cell.kind === 'upload') {
            const { upload } = cell;
            if (upload.error !== null) {
                return (
                    <div className="ym-photos__tile ym-photos__tile--error">
                        <p role="alert" className="type-body-s">
                            {upload.error}
                        </p>
                        <Button
                            variant="ghost"
                            size="xs"
                            onClick={() =>
                                setUploads((list) => list.filter((item) => item.key !== upload.key))
                            }
                        >
                            {ru.photos.dismiss}
                        </Button>
                    </div>
                );
            }
            const progress = upload.progress ?? 0;
            return (
                <div className="ym-photos__tile">
                    <div
                        role="progressbar"
                        aria-label={ru.photos.uploading}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                        className="ym-photos__progress"
                    >
                        <span style={{ width: `${progress}%` }} />
                    </div>
                    <span className="type-caption">{progress} %</span>
                </div>
            );
        }

        const { photo, number, index } = cell;
        const alt = photo.is_serial ? ru.photos.serialAlt : ru.photos.alt(number);

        return (
            <div
                className={`ym-photos__tile ym-photos__tile--photo${photo.state === 'failed' ? ' ym-photos__tile--error' : ''}`}
            >
                {photo.state === 'ready' && photo.urls ? (
                    <picture>
                        <source type="image/avif" srcSet={photo.urls.square.avif} />
                        <source type="image/webp" srcSet={photo.urls.square.webp} />
                        <img
                            className="ym-photos__image"
                            src={photo.urls.square.webp}
                            alt={alt}
                            draggable={false}
                        />
                    </picture>
                ) : null}
                {photo.state === 'processing' ? (
                    <span className="type-caption ym-photos__label">{ru.photos.processing}</span>
                ) : null}
                {photo.state === 'failed' ? (
                    <p role="alert" className="type-body-s">
                        {photo.error}
                    </p>
                ) : null}
                <div className="ym-photos__actions">
                    {!photo.is_serial && index > 0 ? (
                        <Button
                            data-move={`${photo.id}:left`}
                            variant="muted"
                            size="xs"
                            icon="chevron-right"
                            className="ym-photos__move ym-photos__move--left"
                            aria-label={ru.photos.moveLeft(number)}
                            onClick={() => move(photo.id, index - 1, 'left')}
                        />
                    ) : null}
                    {!photo.is_serial && index < others.length - 1 ? (
                        <Button
                            data-move={`${photo.id}:right`}
                            variant="muted"
                            size="xs"
                            icon="chevron-right"
                            className="ym-photos__move"
                            aria-label={ru.photos.moveRight(number)}
                            onClick={() => move(photo.id, index + 1, 'right')}
                        />
                    ) : null}
                    <Button
                        variant="muted"
                        size="xs"
                        icon="x"
                        aria-label={ru.photos.remove(alt)}
                        data-remove={photo.id}
                        onClick={() => remove(photo)}
                    />
                </div>
            </div>
        );
    };

    const cellKey = (cell: Cell, index: number) =>
        cell.kind === 'photo'
            ? `photo-${cell.photo.id}`
            : cell.kind === 'upload'
              ? cell.upload.key
              : `slot-${index}`;

    return (
        <div className="ym-photos" ref={rootRef}>
            <ul className="ym-photos__grid">
                {cells.map((cell, index) => {
                    const draggable = cell.kind === 'photo' && !cell.photo.is_serial;
                    return (
                        <li
                            key={cellKey(cell, index)}
                            className="ym-photos__cell"
                            draggable={draggable}
                            onDragStart={
                                draggable
                                    ? (event) => {
                                          dragging.current = cell.photo.id;
                                          event.dataTransfer?.setData(
                                              DRAG_TYPE,
                                              String(cell.photo.id),
                                          );
                                      }
                                    : undefined
                            }
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => handleDrop(event, cell)}
                        >
                            {renderCell(cell)}
                        </li>
                    );
                })}
            </ul>
            {used >= MAX_PHOTOS ? (
                <p className="type-body-s ym-photos__note">{ru.photos.limitReached}</p>
            ) : null}
            {actionError !== null ? (
                <p role="alert" className="type-body-s ym-photos__error">
                    {actionError}
                </p>
            ) : null}
            <p role="status" className="type-body-s ym-photos__note">
                {missing.length > 0 ? ru.photos.missing(missing) : ''}
            </p>
            <input
                ref={inputRef}
                type="file"
                hidden
                data-testid="photo-input"
                accept={[...ACCEPTED_TYPES, '.heic', '.heif'].join(',')}
                onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = '';
                    if (files.length > 0) void uploadFiles(files, pickSerial.current);
                }}
            />
        </div>
    );
}
