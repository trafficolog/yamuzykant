import { Alert, Button, Field, FilterChip, Icon, PriceGuide, Textarea } from '@ds';
import type { Condition, IconName } from '@ds';
import { router, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

import { ModelCombobox } from '@/Components/ModelCombobox';
import type { ModelOption } from '@/Components/ModelCombobox';
import ListingPreviewCard from '@/Components/ListingPreviewCard';
import PhotoUploader from '@/Components/PhotoUploader';
import type { ListingPhoto } from '@/Components/photoUploaderApi';
import { useFlag } from '@/Hooks/useFlag';
import PublicLayout from '@/Layouts/PublicLayout';
import { ru } from '@/lang/ru';
import { formatPrice, parsePrice } from '@/lib/price';
import { saveDraft } from '@/lib/sellDraft';
import type { DraftPayload } from '@/lib/sellDraft';
import { SERIAL_MAX, TITLE_MAX, fieldErrors, missingItems } from '@/lib/sellForm';
import type { PriceMode } from '@/lib/sellForm';

import '../../../css/sell.css';

/** Категория из shared prop `categories` (CategoryResource): вид → группа → пункт. */
interface SharedCategory {
    id: number;
    name: string;
    slug: string;
    icon: string | null;
    children: SharedCategory[];
}

/** Что даёт страница: shared props шапки и ошибки валидации (Inertia кладёт их в `errors`). */
type SharedProps = {
    categories?: SharedCategory[];
    city?: { id: number; name: string } | null;
    errors?: Record<string, string>;
};

/**
 * Сохранённое содержимое формы (SellController::draftProps). null — форма ещё не сохранялась.
 * Серийный номер целиком не приходит: только маска (AGENTS.md §4).
 */
interface SellDraft {
    kind_id: number | null;
    title: string | null;
    model_id: number | null;
    year: number | null;
    serial_masked: string | null;
    condition: Condition | null;
    description: string | null;
    price_mode: PriceMode;
    price: number | null;
    negotiable: boolean;
    meet: boolean;
    ship: boolean;
}

interface SellCreateProps {
    /** `edit` — изменение опубликованного объявления той же формой (2.1.5): без черновика и автосохранения. */
    mode?: 'create' | 'edit';
    /** Черновик продавца: к нему привязываются фото. */
    listingId: string;
    photos: ListingPhoto[];
    /** Восстанавливаемое содержимое формы после перезагрузки (UC-L1 7b). */
    draft?: SellDraft | null;
    /** Город шапки для «Встреча в г. Москва»: тип населённого пункта и название, без склонения. */
    place?: { type: string; name: string } | null;
    /** Вилка цен продаж модели для PriceGuide; сервер отдаёт её с флагом sale_prices (вне MVP — не отдаёт). */
    priceGuide?: { low: number; high: number; basis: string } | null;
}

/** Поля, у которых есть своё место в форме; остальные ошибки сервера — одним сообщением над кнопкой. */
const FIELD_ERRORS = ['title', 'year', 'serial', 'description', 'price'] as const;

/** Куда уходит фокус после ошибок сервера: поля в порядке формы (id полей). */
const FIELD_IDS: Record<(typeof FIELD_ERRORS)[number], string> = {
    title: 'sell-title',
    year: 'sell-year',
    serial: 'sell-serial',
    description: 'sell-description',
    price: 'sell-price',
};

const STEPS_ID = {
    what: 'sell-step-1',
    photos: 'sell-step-2',
    cond: 'sell-step-3',
    price: 'sell-step-4',
};

/** Как часто автосохранение отправляет несохранённые правки (UC-L1 7b). */
const AUTOSAVE_MS = 5000;

/** Время сохранения по Москве (AGENTS.md §4): «14:03». */
function timeLabel(iso: string | null): string {
    const parsed = iso === null ? new Date() : new Date(iso);
    const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

    return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Moscow',
    });
}

type DraftStatus =
    { kind: 'idle' } | { kind: 'saved'; time: string } | { kind: 'failed'; message: string | null };

/** Корневой вид, в дереве которого лежит категория (модель справочника привязана к пункту, не к виду). */
function rootKindOf(categories: readonly SharedCategory[], categoryId: number): number | null {
    const contains = (node: SharedCategory): boolean =>
        node.id === categoryId || node.children.some(contains);

    return categories.find(contains)?.id ?? null;
}

function Step({
    id,
    number,
    title,
    note,
    children,
}: {
    id: string;
    number: number;
    title: string;
    note?: string;
    children: ReactNode;
}) {
    return (
        <section aria-labelledby={id} className="ym-sell__step">
            <div className="ym-sell__step-head">
                <span className="type-label ym-sell__step-no">{ru.sell.step(number)}</span>
                <h2 id={id} className="type-h3 ym-sell__step-title">
                    {title}
                </h2>
                {note ? <p className="type-body-s ym-sell__hint">{note}</p> : null}
            </div>
            {children}
        </section>
    );
}

/**
 * Форма «Продать инструмент» (UC-L1): четыре шага на одной странице, превью ListingCard справа,
 * список недостающего над кнопкой. «Опубликовать» отправляет форму на публикацию (экран результата — Sell/Published);
 * правки уходят в черновик каждые 5 с, при уходе со страницы и по «Сохранить черновик»; после перезагрузки
 * форма восстанавливается из черновика.
 */
export default function SellCreate({
    mode = 'create',
    listingId,
    photos: initialPhotos,
    draft = null,
    place = null,
    priceGuide = null,
}: SellCreateProps) {
    const editing = mode === 'edit';
    const { props } = usePage<SharedProps>();
    const categories = useMemo(() => props.categories ?? [], [props.categories]);
    const cityName = props.city?.name ?? null;
    const errors = props.errors ?? {};
    const showMasters = useFlag('masters');
    const showPriceGuide = useFlag('sale_prices');
    const safeDeal = useFlag('safe_deal');

    const [kindId, setKindId] = useState<number | null>(
        draft?.kind_id ?? categories[0]?.id ?? null,
    );
    const [title, setTitle] = useState(draft?.title ?? '');
    const [modelId, setModelId] = useState<number | null>(draft?.model_id ?? null);
    const [year, setYear] = useState(draft?.year == null ? '' : String(draft.year));
    // Серийный номер целиком не восстанавливается: поле пустое, пока продавец не введёт новый.
    const [serial, setSerial] = useState('');
    const [serialTouched, setSerialTouched] = useState(false);
    const serialMask = draft?.serial_masked ?? null;
    const [photos, setPhotos] = useState<ListingPhoto[]>(initialPhotos);
    // Фото при изменении пишутся сразу, а не вместе с формой: набор отличается от исходного — правка существенная.
    const photoIds = (list: readonly ListingPhoto[]) =>
        list
            .map((photo) => photo.id)
            .sort()
            .join(',');
    const photosChanged = editing && photoIds(photos) !== photoIds(initialPhotos);
    const [condition, setCondition] = useState<Condition | null>(draft?.condition ?? null);
    const [description, setDescription] = useState(draft?.description ?? '');
    const [priceMode, setPriceMode] = useState<PriceMode>(draft?.price_mode ?? 'amount');
    const [priceText, setPriceText] = useState(
        draft?.price_mode === 'amount' && draft.price ? formatPrice(String(draft.price)) : '',
    );
    const [negotiable, setNegotiable] = useState(
        draft === null || draft.price_mode !== 'amount' ? true : draft.negotiable,
    );
    const [meet, setMeet] = useState(draft?.meet ?? true);
    const [ship, setShip] = useState(draft?.ship ?? true);
    const [sending, setSending] = useState(false);
    const [draftStatus, setDraftStatus] = useState<DraftStatus>({ kind: 'idle' });
    // Превью рисуется только в браузере: в серверной разметке и до гидратации карточка ДС показала бы «0 ₽» (BR-11).
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const alertRef = useRef<HTMLDivElement>(null);

    const price = parsePrice(priceText);
    const limits = fieldErrors({ title, year, serial, description });
    const message = (field: (typeof FIELD_ERRORS)[number]): string | undefined =>
        field === 'price' ? errors.price : (limits[field] ?? errors[field]);
    const missing = missingItems({ title, condition, priceMode, price, meet, ship }, photos);
    const kind = categories.find((item) => item.id === kindId);
    const grade = ru.sell.conditions.find((item) => item.key === condition);
    const previewPhoto = photos.find((photo) => photo.is_serial === false && photo.urls !== null);
    const amountMode = priceMode === 'amount';

    // Содержимое для черновика: неполная форма допустима. Нетронутый серийный номер не отправляется —
    // на сервере остаётся прежний; невалидный год (пока печатают) уходит пустым.
    const serialKept = serialMask !== null && !serialTouched;
    const draftPayload: DraftPayload = {
        listing_id: listingId,
        category_id: kindId,
        title: title.trim() === '' ? null : title.trim(),
        model_id: modelId,
        year: year.length === 4 && limits.year === undefined ? Number(year) : null,
        ...(serialKept ? {} : { serial: serial.trim() === '' ? null : serial.trim() }),
        condition,
        description: description.trim() === '' ? null : description.trim(),
        price_mode: priceMode,
        price: amountMode && price > 0 ? price : null,
        negotiable: amountMode && negotiable,
        meet,
        ship,
    };
    const signature = JSON.stringify(draftPayload);

    // Сигнатура последнего сохранённого (или исходного) состояния: без правок автосохранение молчит.
    const savedSignature = useRef(signature);
    const latest = useRef({ payload: draftPayload, signature });
    const inFlight = useRef(false);
    // «Опубликовать» нажато: черновик больше не трогаем (публикация сама записывает форму).
    const publishing = useRef(false);
    useEffect(() => {
        latest.current = { payload: draftPayload, signature };
    });

    const flush = useCallback(
        async (keepalive: boolean, force = false): Promise<void> => {
            const { payload, signature: current } = latest.current;
            if (editing || publishing.current || inFlight.current) return;
            if (!force && current === savedSignature.current) return;

            inFlight.current = true;
            const result = await saveDraft(payload, keepalive);
            inFlight.current = false;

            if (result.ok) {
                savedSignature.current = current;
                setDraftStatus({ kind: 'saved', time: timeLabel(result.savedAt) });
            } else {
                setDraftStatus({ kind: 'failed', message: result.message });
            }
        },
        [editing],
    );

    useEffect(() => {
        const timer = window.setInterval(() => void flush(false), AUTOSAVE_MS);
        const leave = () => void flush(true);
        const hidden = () => {
            if (document.visibilityState === 'hidden') leave();
        };
        window.addEventListener('pagehide', leave);
        document.addEventListener('visibilitychange', hidden);

        return () => {
            window.clearInterval(timer);
            window.removeEventListener('pagehide', leave);
            document.removeEventListener('visibilitychange', hidden);
            // Переход на другую страницу Inertia: страница не выгружается, pagehide не будет.
            leave();
        };
    }, [flush]);
    // BR-11: в превью «0 ₽» не бывает — «Договорная», «Бесплатно» или просьба указать цену.
    const priceLabel =
        priceMode === 'amount'
            ? price > 0
                ? null
                : ru.sell.previewPricePlaceholder
            : ru.sell.priceModes[priceMode];
    // Повторное нажатие на режим возвращает сумму.
    const toggleMode = (mode: Exclude<PriceMode, 'amount'>) =>
        setPriceMode((current) => (current === mode ? 'amount' : mode));
    const meetLabel = ru.sell.meet(place);

    const selectModel = (model: ModelOption) => {
        setModelId(model.id);
        const root = rootKindOf(categories, model.category_id);
        if (root !== null) setKindId(root);
    };

    // После ответа сервера с ошибками: первое проблемное поле, иначе сообщение над кнопкой (фото, передача и прочее).
    const focusProblem = (serverErrors: Record<string, string>) => {
        window.setTimeout(() => {
            const field = FIELD_ERRORS.find((name) => serverErrors[name] !== undefined);
            const target =
                field === undefined ? alertRef.current : document.getElementById(FIELD_IDS[field]);
            target?.focus();
        }, 0);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (missing.length > 0 || Object.keys(limits).length > 0) return;
        if (kindId === null || condition === null || sending) return;

        publishing.current = true;
        setSending(true);
        const data = {
            listing_id: listingId,
            category_id: kindId,
            title: title.trim(),
            model_id: modelId,
            year: year === '' ? null : Number(year),
            ...(serialKept ? {} : { serial: serial.trim() === '' ? null : serial.trim() }),
            condition,
            description: description.trim() === '' ? null : description.trim(),
            price_mode: priceMode,
            price: amountMode ? price : null,
            negotiable: amountMode && negotiable,
            meet,
            ship,
        };
        const options = {
            preserveScroll: true,
            preserveState: true,
            onFinish: () => setSending(false),
            onError: (serverErrors: Record<string, string>) => {
                publishing.current = false;
                focusProblem(serverErrors);
            },
        };

        if (editing) {
            router.put(
                `/listings/${listingId}`,
                { ...data, photos_changed: photosChanged },
                options,
            );
        } else {
            router.post('/sell', data, options);
        }
    };

    const otherErrors = Object.entries(errors)
        .filter(
            ([field]) => field !== 'limit' && !(FIELD_ERRORS as readonly string[]).includes(field),
        )
        .map(([, message]) => message);

    return (
        <div className="ym-sell">
            <nav aria-label={ru.sell.crumbs.label} className="ym-sell__crumbs">
                <a href="/" className="type-body-s ym-sell__crumb">
                    {ru.sell.crumbs.home}
                </a>
                <span aria-hidden="true" className="ym-sell__crumb-sep">
                    <Icon name="chevron-right" size={14} />
                </span>
                <span aria-current="page" className="type-body-s ym-sell__crumb-current">
                    {editing ? ru.sell.edit.title : ru.sell.title}
                </span>
            </nav>

            <div className="ym-sell__head">
                <h1 className="type-h1 ym-sell__title">
                    {editing ? ru.sell.edit.title : ru.sell.title}
                </h1>
                <p className="type-body-s ym-sell__lead">
                    {editing ? ru.sell.edit.lead : ru.sell.lead}
                </p>
            </div>

            <div className="ym-sell__layout">
                <form className="ym-sell__form" onSubmit={submit} noValidate>
                    <Step id={STEPS_ID.what} number={1} title={ru.sell.steps.what}>
                        <div role="radiogroup" aria-label={ru.sell.kind} className="ym-sell__chips">
                            {categories.map((item) => (
                                <FilterChip
                                    key={item.id}
                                    radio
                                    selected={item.id === kindId}
                                    icon={(item.icon ?? undefined) as IconName | undefined}
                                    onChange={() => setKindId(item.id)}
                                >
                                    {item.name}
                                </FilterChip>
                            ))}
                        </div>
                        <ModelCombobox
                            id="sell-title"
                            value={title}
                            error={message('title')}
                            maxLength={TITLE_MAX}
                            onChange={(text) => {
                                setTitle(text);
                                setModelId(null);
                            }}
                            onSelect={selectModel}
                        />
                        <div className="ym-sell__pair">
                            <Field
                                id="sell-year"
                                label={ru.sell.year.label}
                                placeholder={ru.sell.year.placeholder}
                                inputMode="numeric"
                                value={year}
                                error={message('year')}
                                onChange={(event) =>
                                    setYear(event.target.value.replace(/\D/g, '').slice(0, 4))
                                }
                            />
                            <Field
                                id="sell-serial"
                                label={ru.sell.serial.label}
                                placeholder={ru.sell.serial.placeholder}
                                hint={
                                    serialKept && serialMask !== null
                                        ? ru.sell.draft.serialSaved(serialMask)
                                        : ru.sell.serial.hint
                                }
                                value={serial}
                                maxLength={SERIAL_MAX}
                                error={message('serial')}
                                onChange={(event) => {
                                    setSerial(event.target.value);
                                    setSerialTouched(true);
                                }}
                            />
                        </div>
                    </Step>

                    <Step
                        id={STEPS_ID.photos}
                        number={2}
                        title={ru.sell.steps.photos}
                        note={ru.photos.hint}
                    >
                        <PhotoUploader
                            listingId={listingId}
                            initialPhotos={initialPhotos}
                            onChange={setPhotos}
                            showStatus={false}
                        />
                    </Step>

                    <Step id={STEPS_ID.cond} number={3} title={ru.sell.steps.condition}>
                        <div
                            role="radiogroup"
                            aria-label={ru.sell.conditionGroup}
                            className="ym-sell__chips"
                        >
                            {ru.sell.conditions.map((item) => (
                                <FilterChip
                                    key={item.key}
                                    radio
                                    selected={item.key === condition}
                                    onChange={() => setCondition(item.key)}
                                >
                                    {item.label}
                                </FilterChip>
                            ))}
                        </div>
                        <p className="type-body-s ym-sell__hint">
                            {grade ? grade.hint : ru.sell.conditionHint}
                        </p>
                        <Textarea
                            id="sell-description"
                            label={ru.sell.description.label}
                            placeholder={ru.sell.description.placeholder}
                            rows={5}
                            value={description}
                            error={message('description')}
                            onChange={setDescription}
                        />
                    </Step>

                    <Step id={STEPS_ID.price} number={4} title={ru.sell.steps.price}>
                        <div className="ym-sell__price">
                            <div className="ym-sell__price-col">
                                <Field
                                    id="sell-price"
                                    label={ru.sell.price.label}
                                    suffix={ru.sell.price.suffix}
                                    inputMode="numeric"
                                    placeholder={ru.sell.price.placeholder}
                                    value={amountMode ? priceText : ''}
                                    disabled={!amountMode}
                                    error={message('price')}
                                    onChange={(event) =>
                                        setPriceText(formatPrice(event.target.value))
                                    }
                                />
                                <div className="ym-sell__modes">
                                    <FilterChip
                                        selected={amountMode && negotiable}
                                        disabled={!amountMode}
                                        icon="handshake"
                                        onChange={setNegotiable}
                                    >
                                        {ru.sell.negotiable}
                                    </FilterChip>
                                    <FilterChip
                                        selected={priceMode === 'negotiable'}
                                        onChange={() => toggleMode('negotiable')}
                                    >
                                        {ru.sell.priceModes.negotiable}
                                    </FilterChip>
                                    <FilterChip
                                        selected={priceMode === 'free'}
                                        onChange={() => toggleMode('free')}
                                    >
                                        {ru.sell.priceModes.free}
                                    </FilterChip>
                                </div>
                            </div>
                            {showPriceGuide && priceGuide !== null ? (
                                <PriceGuide
                                    low={priceGuide.low}
                                    high={priceGuide.high}
                                    price={price > 0 ? price : undefined}
                                    basis={priceGuide.basis}
                                />
                            ) : null}
                        </div>
                        <fieldset className="ym-sell__handover">
                            <legend className="type-label ym-sell__legend">
                                {ru.sell.handover}
                            </legend>
                            <div className="ym-sell__chips">
                                <FilterChip selected={meet} icon="map-pin" onChange={setMeet}>
                                    {meetLabel}
                                </FilterChip>
                                <FilterChip selected={ship} icon="truck" onChange={setShip}>
                                    {ru.sell.ship}
                                </FilterChip>
                            </div>
                        </fieldset>
                    </Step>

                    <div className="ym-sell__footer">
                        {otherErrors.length > 0 || errors.limit !== undefined ? (
                            <div ref={alertRef} tabIndex={-1} className="ym-sell__alert">
                                {errors.limit !== undefined ? (
                                    <Alert tone="danger" title={ru.sell.limit.title}>
                                        {errors.limit}
                                    </Alert>
                                ) : null}
                                {otherErrors.length > 0 ? (
                                    <Alert tone="danger" title={ru.sell.errorsTitle}>
                                        {otherErrors.join(' ')}
                                    </Alert>
                                ) : null}
                            </div>
                        ) : null}
                        {missing.length > 0 ? (
                            <p role="status" className="type-body-s ym-sell__missing">
                                {ru.sell.missingList(missing)}
                            </p>
                        ) : null}
                        <div className="ym-sell__actions">
                            <Button
                                variant="primary"
                                size="l"
                                type="submit"
                                disabled={missing.length > 0 || Object.keys(limits).length > 0}
                                loading={sending}
                            >
                                {editing ? ru.sell.edit.save : ru.sell.publish}
                            </Button>
                            {editing ? null : (
                                <Button
                                    variant="ghost"
                                    size="l"
                                    type="button"
                                    disabled={sending}
                                    onClick={() => void flush(false, true)}
                                >
                                    {ru.sell.saveDraft}
                                </Button>
                            )}
                        </div>
                        {draftStatus.kind === 'saved' ? (
                            <p role="status" className="type-body-s ym-sell__draft-status">
                                {ru.sell.draft.saved(draftStatus.time)}
                            </p>
                        ) : null}
                        {draftStatus.kind === 'failed' ? (
                            <p role="status" className="type-body-s ym-sell__draft-status">
                                {draftStatus.message ?? ru.sell.draft.failed}
                            </p>
                        ) : null}
                    </div>
                </form>

                <aside className="ym-sell__aside">
                    <h2 className="type-label ym-sell__aside-title">{ru.sell.previewTitle}</h2>
                    <div className={`ym-sell__preview${mounted ? '' : ' is-pending'}`}>
                        {mounted ? (
                            <ListingPreviewCard
                                priceLabel={priceLabel}
                                title={title.trim() || ru.sell.previewPlaceholder}
                                price={priceLabel ? 0 : price}
                                condition={condition ?? 'excellent'}
                                image={previewPhoto?.urls?.square.webp}
                                icon={(kind?.icon ?? undefined) as IconName | undefined}
                                city={cityName ?? undefined}
                                posted={ru.sell.posted}
                                shipping={ship ? 0 : undefined}
                                safe={safeDeal}
                            />
                        ) : null}
                    </div>
                    {showMasters ? (
                        <Alert tone="service" icon="wrench" title={ru.sell.masters.title}>
                            {ru.sell.masters.text}
                        </Alert>
                    ) : null}
                </aside>
            </div>
        </div>
    );
}

SellCreate.layout = (page: ReactNode) => <PublicLayout tab="sell">{page}</PublicLayout>;
