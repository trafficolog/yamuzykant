import { Button, Field, Radio } from '@ds';
import { router } from '@inertiajs/react';
import { useState } from 'react';
import type { FormEvent } from 'react';

import Modal from '@/Components/Modal';
import { ru } from '@/lang/ru';
import { formatPrice as formatRubles } from '@/lib/messages';
import { wasShown, type MyListing } from '@/lib/myListings';
import { formatPrice, parsePrice } from '@/lib/price';

const t = ru.account.listingsPage;

type Errors = Record<string, string>;

export interface DialogProps {
    listing: MyListing;
    onClose: () => void;
}

/** Окно «Снизить цену»: новая сумма ниже текущей; сервер проверяет то же и пишет снижение без повторной модерации. */
export function LowerPriceDialog({ listing, onClose }: DialogProps) {
    const [text, setText] = useState('');
    const [errors, setErrors] = useState<Errors>({});
    const [sending, setSending] = useState(false);
    const price = parsePrice(text);
    const current = listing.price ?? 0;
    const invalid = price <= 0 || price >= current;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (invalid || sending) return;

        setSending(true);
        router.patch(
            `/listings/${listing.id}/price`,
            { price },
            {
                preserveScroll: true,
                onSuccess: onClose,
                onError: setErrors,
                onFinish: () => setSending(false),
            },
        );
    };

    return (
        <Modal title={t.lower.title} onClose={onClose}>
            <form className="ym-modal__form" onSubmit={submit} noValidate>
                <p className="type-body-s ym-modal__text">
                    {t.lower.current(formatRubles(listing.price))}
                </p>
                <Field
                    id="lower-price"
                    label={t.lower.label}
                    suffix={ru.sell.price.suffix}
                    inputMode="numeric"
                    value={text}
                    error={errors.price ?? (text !== '' && invalid ? t.lower.invalid : undefined)}
                    onChange={(event) => setText(formatPrice(event.target.value))}
                />
                <div className="ym-modal__actions">
                    <Button variant="primary" type="submit" disabled={invalid} loading={sending}>
                        {t.lower.submit}
                    </Button>
                    <Button variant="ghost" type="button" onClick={onClose}>
                        {t.lower.cancel}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

/**
 * Окно «Снять с продажи»: причина и, для «продал», необязательная итоговая цена (UC-L4). Сумма публично не показывается.
 * «Продал на ЯМузыканте» и сумма — только у показанного объявления (опубликованного или с истёкшим сроком).
 */
export function WithdrawDialog({ listing, onClose }: DialogProps) {
    const shown = wasShown(listing.status);
    const reasons = Object.keys(t.withdrawDialog.reasons).filter(
        (key) => shown || key !== 'sold_here',
    );
    const [reason, setReason] = useState<string>('');
    const [priceText, setPriceText] = useState('');
    const [errors, setErrors] = useState<Errors>({});
    const [sending, setSending] = useState(false);
    const sold = reason === 'sold_here' || reason === 'sold_elsewhere';
    const finalPrice = parsePrice(priceText);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (reason === '' || sending) return;

        setSending(true);
        router.post(
            `/listings/${listing.id}/withdraw`,
            { reason, ...(shown && sold && finalPrice > 0 ? { final_price: finalPrice } : {}) },
            {
                preserveScroll: true,
                onSuccess: onClose,
                onError: setErrors,
                onFinish: () => setSending(false),
            },
        );
    };

    return (
        <Modal title={t.withdrawDialog.title} onClose={onClose}>
            <form className="ym-modal__form" onSubmit={submit} noValidate>
                <Radio
                    name="withdraw-reason"
                    label={t.withdrawDialog.reason}
                    options={reasons.map((key) => ({
                        value: key,
                        label: t.withdrawDialog.reasons[key] ?? key,
                    }))}
                    value={reason}
                    error={errors.reason}
                    onChange={setReason}
                />
                {shown && sold ? (
                    <Field
                        id="withdraw-final-price"
                        label={t.withdrawDialog.finalPrice}
                        hint={t.withdrawDialog.finalPriceHint}
                        suffix={ru.sell.price.suffix}
                        inputMode="numeric"
                        value={priceText}
                        error={errors.final_price}
                        onChange={(event) => setPriceText(formatPrice(event.target.value))}
                    />
                ) : null}
                {errors.listing ? (
                    <p role="alert" className="type-body-s ym-modal__error">
                        {errors.listing}
                    </p>
                ) : null}
                <div className="ym-modal__actions">
                    <Button
                        variant="primary"
                        type="submit"
                        disabled={reason === ''}
                        loading={sending}
                    >
                        {t.withdrawDialog.submit}
                    </Button>
                    <Button variant="ghost" type="button" onClick={onClose}>
                        {t.withdrawDialog.cancel}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
