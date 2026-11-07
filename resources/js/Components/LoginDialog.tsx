import { Alert, Button, Checkbox, Field } from '@ds';
import { router } from '@inertiajs/react';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import CityPicker, { type CityOption } from '@/Components/CityPicker';
import { type LoginOutcome, safeReturnPath } from '@/Hooks/loginDialog';
import { ru } from '@/lang/ru';
import { type JsonResult, postJson } from '@/lib/postJson';

export interface LoginDialogProps {
    /** Город шапки: по умолчанию в шаге «Первый вход». */
    city: CityOption | null;
    /** Относительный путь, куда вернуться после входа. */
    returnTo: string;
    /** Итог входа через Яндекс ID: окно открывается сразу на нужном шаге. */
    outcome?: LoginOutcome | null;
    /** Элемент для возврата фокуса; без него (`null`) — кнопка «Войти» шапки, не указан — активный элемент. */
    opener?: HTMLElement | null;
    onClose: () => void;
    /** Продолжить прерванное действие: вызывается, когда страница уже обновлена. */
    onAuthenticated?: () => void;
}

type Step = 'method' | 'code' | 'first' | 'done';
type FieldName = 'email' | 'code' | 'name' | 'city' | 'consent';
type Errors = Partial<Record<FieldName, string>>;

/** Коды и регистрация — JSON-эндпоинты 1.1.1 и 1.1.5. «Яндекс-почта» — шаг, когда Яндекс ID не отдал почту. */
const ENDPOINTS = {
    email: { code: '/auth/email/code', verify: '/auth/email/verify' },
    yandexEmail: { code: '/auth/yandex/email/code', verify: '/auth/yandex/email/verify' },
    register: '/auth/register',
} as const;
const YANDEX_REDIRECT = '/auth/yandex/redirect';

/** Повторная отправка кода — через 60 с (SPEC UC-A1). */
const RESEND_SECONDS = 60;
const CODE_LENGTH = 6;

/** Правила и политика ПДн: документов и адресов пока нет (тексты даёт OWNER), ссылки ведут на заглушку. */
const RULES_HREF = '#';
const POLICY_HREF = '#';

const IDS = {
    title: 'login-title',
    email: 'login-email',
    code: 'login-code',
    name: 'login-name',
    city: 'login-city',
    citySearch: 'login-city-search',
    consent: 'login-consent',
    missing: 'login-missing',
} as const;

const TOGGLE_ID = 'site-login-toggle';
const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), [tabindex]:not([tabindex="-1"])';

const FIELD_ERRORS: Readonly<Record<string, FieldName>> = {
    email: 'email',
    code: 'code',
    name: 'name',
    city_id: 'city',
    consent: 'consent',
};

/**
 * Окно входа (UC-A1): «Войти с Яндекс ID» и почта → код из письма → при первом входе имя, город и
 * согласие. Собрано из Button, Field, Checkbox и Alert ДС; на < 640 px — полноэкранная шторка.
 *
 * Модальный диалог: фокус уходит в окно и не выходит из него (Tab, Shift+Tab), Esc закрывает
 * (в выборе города — возвращает к форме), страница под окном недоступна, при закрытии фокус
 * возвращается на элемент, открывший окно.
 */
export default function LoginDialog({
    city,
    returnTo,
    outcome = null,
    opener,
    onClose,
    onAuthenticated,
}: LoginDialogProps) {
    const [returnFocusTo] = useState<HTMLElement | null>(() => {
        if (opener !== undefined) return opener;
        const active = document.activeElement;
        return active instanceof HTMLElement && active !== document.body ? active : null;
    });

    const [step, setStep] = useState<Step>(
        outcome?.status === 'registration_required' ? 'first' : 'method',
    );
    const [yandexEmail, setYandexEmail] = useState(outcome?.status === 'email_required');
    const [notice, setNotice] = useState<string | null>(
        outcome?.status === 'yandex_cancelled' ? outcome.message : null,
    );
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [name, setName] = useState(
        outcome?.status === 'registration_required' ? (outcome.name ?? '') : '',
    );
    const [chosenCity, setChosenCity] = useState<CityOption | null>(city);
    const [consent, setConsent] = useState(false);
    const [cityView, setCityView] = useState(false);

    const [busy, setBusy] = useState(false);
    const [errors, setErrors] = useState<Errors>({});
    const [failure, setFailure] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const [resendAt, setResendAt] = useState<number | null>(null);
    const [block, setBlock] = useState<{ until: number; message: string } | null>(null);

    const panelRef = useRef<HTMLDivElement>(null);
    const busyRef = useRef(false);
    const focusAfter = useRef<string | null>(null);
    const lastFocused = useRef<HTMLElement | null>(null);

    const blocked = block !== null && now < block.until;
    const resendIn = resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));
    const ticking = blocked || resendIn > 0;

    // Секундомер: обратный отсчёт повтора и снятие блока. Идёт, только пока есть что отсчитывать.
    useEffect(() => {
        if (!ticking) return;

        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, [ticking]);

    const close = useCallback(() => onClose(), [onClose]);

    // Esc: в выборе города — назад к форме, иначе закрыть окно. Tab и Shift+Tab ходят по кругу внутри окна.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (cityView) {
                    focusAfter.current = IDS.city;
                    setCityView(false);
                } else {
                    close();
                }
                return;
            }
            if (event.key !== 'Tab') return;

            const items = Array.from(
                panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
            );
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
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [cityView, close]);

    // Окно модальное: страница под ним недоступна и не прокручивается; фокус вернётся при закрытии.
    useEffect(() => {
        const root = document.getElementById('app');
        const previousOverflow = document.body.style.overflow;
        root?.setAttribute('inert', '');
        document.body.style.overflow = 'hidden';

        return () => {
            root?.removeAttribute('inert');
            document.body.style.overflow = previousOverflow;

            const target =
                returnFocusTo?.isConnected === true
                    ? returnFocusTo
                    : document.getElementById(TOGGLE_ID);
            target?.focus();
        };
    }, [returnFocusTo]);

    // Фокус, ушедший за пределы окна, возвращается внутрь.
    useEffect(() => {
        const onFocusIn = (event: FocusEvent) => {
            const panel = panelRef.current;
            const target = event.target;
            if (!panel || !(target instanceof Node)) return;

            if (panel.contains(target)) {
                if (target instanceof HTMLElement) lastFocused.current = target;
                return;
            }
            const first = panel.querySelector<HTMLElement>(FOCUSABLE);
            (lastFocused.current?.isConnected ? lastFocused.current : first)?.focus();
        };
        document.addEventListener('focusin', onFocusIn);
        return () => document.removeEventListener('focusin', onFocusIn);
    }, []);

    // Фокус на первое поле шага при открытии и при смене шага или вида.
    useEffect(() => {
        const pending = focusAfter.current;
        focusAfter.current = null;
        const id =
            pending ??
            (cityView
                ? IDS.citySearch
                : step === 'method'
                  ? IDS.email
                  : step === 'code'
                    ? IDS.code
                    : step === 'first'
                      ? IDS.name
                      : null);
        const target = id ? document.getElementById(id) : null;
        (target ?? panelRef.current)?.focus();
    }, [step, cityView]);

    const resetMessages = () => {
        setErrors({});
        setFailure(null);
        setNotice(null);
        setInfo(null);
    };

    /** Запрос к серверу: `null`, если ответа нет (сеть). */
    const send = async (url: string, data: Record<string, unknown>): Promise<JsonResult | null> => {
        busyRef.current = true;
        setBusy(true);
        resetMessages();
        try {
            return await postJson(url, data);
        } catch {
            setFailure(ru.login.networkError);
            return null;
        } finally {
            busyRef.current = false;
            setBusy(false);
        }
    };

    /** Отказ сервера: ошибки у полей (422), блок (429), устаревшая страница (419), потерянная сессия (409). */
    const fail = (result: JsonResult) => {
        const message = typeof result.body.message === 'string' ? result.body.message : null;

        if (result.status === 422) {
            const raw = result.body.errors;
            const next: Errors = {};
            if (typeof raw === 'object' && raw !== null) {
                for (const [key, messages] of Object.entries(raw)) {
                    const field = FIELD_ERRORS[key];
                    const text = Array.isArray(messages) ? messages[0] : null;
                    if (field && typeof text === 'string') next[field] = text;
                }
            }
            setErrors(next);
            if (Object.keys(next).length === 0) setFailure(message ?? ru.login.failed);
        } else if (result.status === 429) {
            const seconds = Number(result.body.retry_after);
            const wait = Number.isFinite(seconds) && seconds > 0 ? seconds : 60;
            const at = Date.now();
            setNow(at);
            setBlock({ until: at + wait * 1000, message: message ?? ru.login.failed });
        } else if (result.status === 419) {
            setFailure(ru.login.expired);
        } else if (result.status === 409) {
            // Подтверждённая почта или Яндекс ID потеряны: начинаем с первого шага.
            setYandexEmail(false);
            setStep('method');
            setNotice(message ?? ru.login.failed);
        } else {
            setFailure(message ?? ru.login.failed);
        }
    };

    const finish = (redirect: unknown) => {
        setStep('done');
        // Адрес с сервера (url.intended) главнее текущей страницы; «/» означает «адреса нет».
        const target =
            typeof redirect === 'string' && redirect !== '/' ? safeReturnPath(redirect) : returnTo;
        router.visit(target, {
            preserveScroll: true,
            onFinish: () => {
                onAuthenticated?.();
                close();
            },
        });
    };

    const accept = (result: JsonResult) => {
        const status = result.body.status;

        if (status === 'authenticated') {
            finish(result.body.redirect);
        } else if (status === 'registration_required') {
            const suggested = result.body.name;
            setName((current) => current || (typeof suggested === 'string' ? suggested : ''));
            setStep('first');
        } else {
            fail(result);
        }
    };

    const requestCode = async (resend: boolean) => {
        if (busyRef.current || blocked) return;

        const endpoint = yandexEmail ? ENDPOINTS.yandexEmail : ENDPOINTS.email;
        const result = await send(endpoint.code, { email: email.trim() });
        if (!result) return;

        if (result.status === 202) {
            const at = Date.now();
            setNow(at);
            setResendAt(at + RESEND_SECONDS * 1000);
            setCode('');
            setStep('code');
            if (resend) setInfo(ru.login.resent);
        } else {
            fail(result);
        }
    };

    const verify = async (digits: string) => {
        if (busyRef.current || blocked) return;

        const endpoint = yandexEmail ? ENDPOINTS.yandexEmail : ENDPOINTS.email;
        const result = await send(endpoint.verify, { email: email.trim(), code: digits });
        if (!result) return;

        if (result.status === 200) {
            accept(result);
        } else {
            fail(result);
            if (result.status === 422) {
                setCode('');
                document.getElementById(IDS.code)?.focus();
            }
        }
    };

    const missing: string[] = [];
    if (name.trim() === '') missing.push(ru.login.missingName);
    if (chosenCity === null) missing.push(ru.login.missingCity);
    if (!consent) missing.push(ru.login.missingConsent);

    const register = async () => {
        if (busyRef.current || missing.length > 0) return;

        const result = await send(ENDPOINTS.register, {
            name: name.trim(),
            city_id: chosenCity?.id ?? null,
            consent: true,
        });
        if (!result) return;

        if (result.status === 200) accept(result);
        else fail(result);
    };

    const onSubmit = (action: () => void) => (event: FormEvent) => {
        event.preventDefault();
        action();
    };

    const onCodeChange = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
        setCode(digits);
        setErrors({});
        if (digits.length === CODE_LENGTH) void verify(digits);
    };

    const title = cityView
        ? ru.city.label
        : step === 'code'
          ? ru.login.titleCode
          : step === 'first'
            ? ru.login.titleFirst
            : step === 'done'
              ? ru.login.titleDone
              : yandexEmail
                ? ru.login.titleYandexEmail
                : ru.login.title;

    // Одно сообщение над формой: блок важнее ошибки запроса, ошибка — отказа Яндекса.
    const banner = blocked ? block.message : (failure ?? notice);
    const alert = banner ? <Alert tone="danger">{banner}</Alert> : null;

    const yandexHref = `${YANDEX_REDIRECT}?${new URLSearchParams({ return: safeReturnPath(returnTo) })}`;

    return createPortal(
        <div className="ym-root ym-login">
            <div className="ym-login__scrim" aria-hidden="true" onClick={close} />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={IDS.title}
                tabIndex={-1}
                className="ym-login__panel"
            >
                <div className="ym-login__head">
                    <h2 id={IDS.title} className="ym-login__title type-h3">
                        {title}
                    </h2>
                    <Button variant="ghost" icon="x" aria-label={ru.login.close} onClick={close} />
                </div>

                {cityView ? (
                    <div className="ym-login__form">
                        <Button
                            variant="ghost"
                            icon="chevron-right"
                            className="ym-login__back"
                            onClick={() => {
                                focusAfter.current = IDS.city;
                                setCityView(false);
                            }}
                        >
                            {ru.login.back}
                        </Button>
                        <CityPicker
                            searchId={IDS.citySearch}
                            selectedId={chosenCity?.id}
                            onChoose={(picked) => {
                                setChosenCity(picked);
                                setErrors((current) => ({ ...current, city: undefined }));
                                focusAfter.current = IDS.city;
                                setCityView(false);
                            }}
                        />
                    </div>
                ) : step === 'method' ? (
                    <form
                        noValidate
                        className="ym-login__form"
                        onSubmit={onSubmit(() => void requestCode(false))}
                    >
                        {alert}
                        {yandexEmail ? (
                            <p className="ym-login__text type-body-s">
                                {ru.login.yandexEmailIntro}
                            </p>
                        ) : (
                            <>
                                <Button variant="outline" block href={yandexHref}>
                                    {ru.login.yandex}
                                </Button>
                                <div className="ym-login__or" aria-hidden="true">
                                    <span />
                                    <span className="type-body-s">{ru.login.orEmail}</span>
                                    <span />
                                </div>
                            </>
                        )}
                        <Field
                            id={IDS.email}
                            type="email"
                            label={ru.login.emailLabel}
                            hint={ru.login.emailHint}
                            error={errors.email}
                            autoComplete="email"
                            inputMode="email"
                            value={email}
                            onChange={(event) => {
                                setEmail(event.target.value);
                                setErrors({});
                            }}
                        />
                        <Button
                            type="submit"
                            variant="primary"
                            block
                            loading={busy}
                            disabled={blocked}
                        >
                            {ru.login.getCode}
                        </Button>
                    </form>
                ) : step === 'code' ? (
                    <form
                        noValidate
                        className="ym-login__form"
                        onSubmit={onSubmit(() => {
                            if (code.length === CODE_LENGTH) void verify(code);
                        })}
                    >
                        {alert}
                        <p className="ym-login__text type-body-s">
                            {ru.login.codeSent(email.trim())}
                        </p>
                        <Button
                            variant="ghost"
                            size="s"
                            onClick={() => {
                                setStep('method');
                                resetMessages();
                            }}
                        >
                            {ru.login.changeEmail}
                        </Button>
                        <Field
                            id={IDS.code}
                            label={ru.login.codeLabel}
                            hint={ru.login.codeHint}
                            error={errors.code}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            disabled={blocked}
                            value={code}
                            onChange={(event) => onCodeChange(event.target.value)}
                        />
                        <Button
                            type="submit"
                            variant="primary"
                            block
                            loading={busy}
                            disabled={blocked || code.length < CODE_LENGTH}
                        >
                            {ru.login.signIn}
                        </Button>
                        {resendIn > 0 ? (
                            <p className="ym-login__text type-body-s">
                                {ru.login.resendIn(resendIn)}
                            </p>
                        ) : (
                            <Button
                                variant="outline"
                                block
                                disabled={blocked || busy}
                                onClick={() => void requestCode(true)}
                            >
                                {ru.login.resend}
                            </Button>
                        )}
                        {info ? (
                            <p role="status" className="ym-login__text type-body-s">
                                {info}
                            </p>
                        ) : null}
                    </form>
                ) : step === 'first' ? (
                    <form noValidate className="ym-login__form" onSubmit={onSubmit(register)}>
                        {alert}
                        <p className="ym-login__text type-body-s">{ru.login.firstIntro}</p>
                        <Field
                            id={IDS.name}
                            label={ru.login.nameLabel}
                            error={errors.name}
                            autoComplete="name"
                            value={name}
                            onChange={(event) => {
                                setName(event.target.value);
                                setErrors((current) => ({ ...current, name: undefined }));
                            }}
                        />
                        <div className="ym-login__city">
                            <span className="ym-field__label">{ru.login.cityLabel}</span>
                            <Button
                                id={IDS.city}
                                variant="outline"
                                block
                                icon="map-pin"
                                iconRight="chevron-right"
                                aria-label={ru.login.cityButton(
                                    chosenCity?.name ?? ru.header.defaultCity,
                                )}
                                onClick={() => setCityView(true)}
                            >
                                {chosenCity?.name ?? ru.header.defaultCity}
                            </Button>
                            {errors.city ? (
                                <p className="ym-login__error type-body-s">{errors.city}</p>
                            ) : null}
                        </div>
                        <Checkbox
                            id={IDS.consent}
                            checked={consent}
                            error={errors.consent}
                            onChange={(checked) => {
                                setConsent(checked);
                                setErrors((current) => ({ ...current, consent: undefined }));
                            }}
                            label={
                                <>
                                    {ru.login.consentPrefix}
                                    <a href={RULES_HREF}>{ru.login.consentRules}</a>
                                    {ru.login.consentAnd}
                                    <a href={POLICY_HREF}>{ru.login.consentPolicy}</a>
                                </>
                            }
                        />
                        {missing.length > 0 ? (
                            <p id={IDS.missing} className="ym-login__text type-body-s">
                                {ru.login.missing(missing)}
                            </p>
                        ) : null}
                        <Button
                            type="submit"
                            variant="primary"
                            block
                            loading={busy}
                            disabled={missing.length > 0}
                            aria-describedby={missing.length > 0 ? IDS.missing : undefined}
                        >
                            {ru.login.proceed}
                        </Button>
                    </form>
                ) : (
                    <div role="status" className="ym-login__form">
                        <p className="type-body">{ru.login.done}</p>
                        <p className="ym-login__text type-body-s">{ru.login.doneHint}</p>
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}
