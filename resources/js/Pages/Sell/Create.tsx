import { Alert, Button, Field, FilterChip, Icon, PriceGuide, Textarea } from '@ds';
import type { Condition, IconName } from '@ds';
import { router, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
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
import { missingItems } from '@/lib/sellForm';
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

interface SellCreateProps {
    /** Черновик продавца: к нему привязываются фото. */
    listingId: string;
    photos: ListingPhoto[];
    /** Содержимое формы только что записано в черновик. */
    saved: boolean;
    /** Вилка цен продаж модели для PriceGuide; сервер отдаёт её с флагом sale_prices (вне MVP — не отдаёт). */
    priceGuide?: { low: number; high: number; basis: string } | null;
}

/** Поля, у которых есть своё место в форме; остальные ошибки сервера — одним сообщением над кнопкой. */
const FIELD_ERRORS = ['title', 'year', 'serial', 'description', 'price'] as const;

const STEPS_ID = {
    what: 'sell-step-1',
    photos: 'sell-step-2',
    cond: 'sell-step-3',
    price: 'sell-step-4',
};

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
 * Форма «Продать инструмент» (UC-L1 п. 1–6): четыре шага на одной странице, превью ListingCard справа,
 * список недостающего над кнопкой. Сейчас форма записывает содержимое в черновик (StoreListingRequest);
 * публикация, автосохранение и экран «Опубликовано» — 2.1.4.
 */
export default function SellCreate({
    listingId,
    photos: initialPhotos,
    saved,
    priceGuide = null,
}: SellCreateProps) {
    const { props } = usePage<SharedProps>();
    const categories = useMemo(() => props.categories ?? [], [props.categories]);
    const cityName = props.city?.name ?? null;
    const errors = props.errors ?? {};
    const showMasters = useFlag('masters');
    const showPriceGuide = useFlag('sale_prices');
    const safeDeal = useFlag('safe_deal');

    const [kindId, setKindId] = useState<number | null>(categories[0]?.id ?? null);
    const [title, setTitle] = useState('');
    const [modelId, setModelId] = useState<number | null>(null);
    const [year, setYear] = useState('');
    const [serial, setSerial] = useState('');
    const [photos, setPhotos] = useState<ListingPhoto[]>(initialPhotos);
    const [condition, setCondition] = useState<Condition | null>(null);
    const [description, setDescription] = useState('');
    const [priceMode, setPriceMode] = useState<PriceMode>('amount');
    const [priceText, setPriceText] = useState('');
    const [negotiable, setNegotiable] = useState(true);
    const [meet, setMeet] = useState(true);
    const [ship, setShip] = useState(true);
    const [sending, setSending] = useState(false);

    const price = parsePrice(priceText);
    const missing = missingItems({ title, condition, priceMode, price, meet, ship }, photos);
    const kind = categories.find((item) => item.id === kindId);
    const grade = ru.sell.conditions.find((item) => item.key === condition);
    const previewPhoto = photos.find((photo) => photo.is_serial === false && photo.urls !== null);
    const amountMode = priceMode === 'amount';
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
    const meetLabel = ru.sell.meet(cityName === null ? null : (ru.cityLocative[cityName] ?? null));

    const selectModel = (model: ModelOption) => {
        setModelId(model.id);
        const root = rootKindOf(categories, model.category_id);
        if (root !== null) setKindId(root);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (missing.length > 0 || kindId === null || condition === null || sending) return;

        router.post(
            '/sell',
            {
                listing_id: listingId,
                category_id: kindId,
                title: title.trim(),
                model_id: modelId,
                year: year === '' ? null : Number(year),
                serial: serial.trim() === '' ? null : serial.trim(),
                condition,
                description: description.trim() === '' ? null : description.trim(),
                price_mode: priceMode,
                price: amountMode ? price : null,
                negotiable: amountMode && negotiable,
                meet,
                ship,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setSending(true),
                onFinish: () => setSending(false),
            },
        );
    };

    const otherErrors = Object.entries(errors)
        .filter(([field]) => !(FIELD_ERRORS as readonly string[]).includes(field))
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
                    {ru.sell.title}
                </span>
            </nav>

            <div className="ym-sell__head">
                <h1 className="type-h1 ym-sell__title">{ru.sell.title}</h1>
                <p className="type-body-s ym-sell__lead">{ru.sell.lead}</p>
            </div>

            {saved ? (
                <div className="ym-sell__saved">
                    <Alert tone="success" title={ru.sell.saved.title}>
                        {ru.sell.saved.text}
                    </Alert>
                </div>
            ) : null}

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
                            error={errors.title}
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
                                error={errors.year}
                                onChange={(event) =>
                                    setYear(event.target.value.replace(/\D/g, '').slice(0, 4))
                                }
                            />
                            <Field
                                id="sell-serial"
                                label={ru.sell.serial.label}
                                placeholder={ru.sell.serial.placeholder}
                                hint={ru.sell.serial.hint}
                                value={serial}
                                error={errors.serial}
                                onChange={(event) => setSerial(event.target.value)}
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
                            error={errors.description}
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
                                    error={errors.price}
                                    onChange={(event) =>
                                        setPriceText(formatPrice(event.target.value))
                                    }
                                />
                                <div className="ym-sell__chips">
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
                                    price={price}
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
                        {otherErrors.length > 0 ? (
                            <Alert tone="danger" title={ru.sell.errorsTitle}>
                                {otherErrors.join(' ')}
                            </Alert>
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
                                disabled={missing.length > 0}
                                loading={sending}
                            >
                                {ru.sell.publish}
                            </Button>
                        </div>
                    </div>
                </form>

                <aside className="ym-sell__aside">
                    <h2 className="type-label ym-sell__aside-title">{ru.sell.previewTitle}</h2>
                    <div className="ym-sell__preview">
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
