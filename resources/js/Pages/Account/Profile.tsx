import { Badge, Button, Checkbox, Field } from '@ds';
import { router, usePage } from '@inertiajs/react';
import { useState, type FormEvent, type ReactNode } from 'react';

import CityPicker, { type CityListItem } from '@/Components/CityPicker';
import AccountLayout from '@/Layouts/AccountLayout';
import { ru } from '@/lang/ru';
import { capitalize, memberSince } from '@/lib/account';

interface ProfileCity {
    id: number;
    name: string;
    /** «г.», «пос.», «д.» */
    type: string;
}

interface Props {
    profile: {
        name: string;
        /** Почта входа: сервер отдаёт её только владельцу (BR-04). */
        email: string;
        city: ProfileCity | null;
        yandex_connected: boolean;
        /** `ГГГГ-ММ` регистрации. */
        since: string | null;
    };
    notifications: { key: string; enabled: boolean }[];
}

// Тип-алиас, а не interface: PageProps из @inertiajs/core требует индексной сигнатуры.
type ErrorProps = { errors?: Record<string, string> };

const t = ru.account.profilePage;

const NAME_ID = 'profile-name';
const EMAIL_ID = 'profile-email';
const CITY_SEARCH_ID = 'profile-city-search';
const CITY_TOGGLE_ID = 'profile-city-toggle';

const cityLabel = (city: ProfileCity | null): string =>
    city === null ? t.cityNone : t.cityLabel(city.type, city.name);

/**
 * Вкладка «Профиль» (UC-A2): имя и город сохраняются кнопкой, уведомления — сразу по флажку. Почта — только
 * просмотр (смена почты — отдельная карточка), Яндекс ID — отметка. Удаление аккаунта — заглушка до 6.3.2.
 */
export default function AccountProfile({ profile, notifications }: Props) {
    const { props } = usePage<ErrorProps>();
    const errors = props.errors ?? {};

    const [name, setName] = useState(profile.name);
    const [city, setCity] = useState<ProfileCity | null>(profile.city);
    const [picking, setPicking] = useState(false);
    const [busy, setBusy] = useState(false);
    const [prefs, setPrefs] = useState<Record<string, boolean>>(
        Object.fromEntries(notifications.map((item) => [item.key, item.enabled])),
    );
    const [status, setStatus] = useState<{ text: string; failed: boolean } | null>(null);

    const since = memberSince(profile.since);

    const save = (event: FormEvent) => {
        event.preventDefault();
        setStatus(null);
        router.patch(
            '/account/profile',
            { name, city_id: city?.id ?? null },
            {
                preserveScroll: true,
                onStart: () => setBusy(true),
                onSuccess: () => setStatus({ text: t.saved, failed: false }),
                onError: () => setStatus({ text: t.saveFailed, failed: true }),
                onFinish: () => setBusy(false),
            },
        );
    };

    const choose = (item: CityListItem) => {
        setCity({ id: item.id, name: item.name, type: item.type ?? 'г.' });
        setPicking(false);
        document.getElementById(CITY_TOGGLE_ID)?.focus();
    };

    const toggle = (key: string, enabled: boolean) => {
        const next = { ...prefs, [key]: enabled };
        setPrefs(next);
        setStatus(null);
        router.put('/account/notifications', next, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => setStatus({ text: t.notificationsSaved, failed: false }),
            onError: () => {
                setPrefs(prefs);
                setStatus({ text: t.notificationsFailed, failed: true });
            },
        });
    };

    return (
        <div className="ym-account-profile">
            <p
                role="status"
                className={`type-body ym-account-profile__status${status?.failed ? ' ym-account-profile__status--failed' : ''}`}
            >
                {status?.text ?? ''}
            </p>

            <form className="ym-account-section" onSubmit={save} noValidate>
                <div className="ym-account-section__intro">
                    <h2 className="type-h3">{t.personal}</h2>
                    <p className="type-body-s ym-account-section__text">{t.personalHint}</p>
                    {since ? (
                        <p className="type-body-s ym-account-section__text">{capitalize(since)}</p>
                    ) : null}
                </div>

                <div className="ym-account-section__fields">
                    <Field
                        id={NAME_ID}
                        label={t.name}
                        value={name}
                        autoComplete="name"
                        maxLength={255}
                        error={errors.name}
                        onChange={(event) => setName(event.target.value)}
                    />

                    <div className="ym-account-city">
                        <span className="type-label">{t.city}</span>
                        <div className="ym-account-city__row">
                            <span className="type-body">{cityLabel(city)}</span>
                            <Button
                                id={CITY_TOGGLE_ID}
                                type="button"
                                variant="outline"
                                size="s"
                                aria-label={t.cityChange}
                                aria-expanded={picking}
                                aria-controls={picking ? 'profile-city-panel' : undefined}
                                onClick={() => setPicking((open) => !open)}
                            >
                                {t.cityChangeLabel}
                            </Button>
                        </div>
                        {errors.city_id ? (
                            <p role="alert" className="type-body-s ym-account-profile__error">
                                {errors.city_id}
                            </p>
                        ) : null}
                        {picking ? (
                            <div id="profile-city-panel" className="ym-account-city__panel">
                                <CityPicker
                                    searchId={CITY_SEARCH_ID}
                                    selectedId={city?.id}
                                    onChoose={choose}
                                />
                            </div>
                        ) : null}
                    </div>

                    <div>
                        <Button type="submit" variant="inverse" loading={busy}>
                            {t.save}
                        </Button>
                    </div>
                </div>
            </form>

            <section aria-label={t.signIn} className="ym-account-section">
                <div className="ym-account-section__intro">
                    <h2 className="type-h3">{t.signIn}</h2>
                </div>
                <div className="ym-account-section__fields">
                    <Field
                        id={EMAIL_ID}
                        label={t.email}
                        value={profile.email}
                        hint={t.emailHint}
                        readOnly
                        autoComplete="email"
                    />
                    {profile.yandex_connected ? (
                        <div>
                            <Badge tone="info" icon="badge-check">
                                {t.yandex}
                            </Badge>
                        </div>
                    ) : null}
                </div>
            </section>

            <section aria-label={t.notifications} className="ym-account-section">
                <div className="ym-account-section__intro">
                    <h2 className="type-h3">{t.notifications}</h2>
                    <p className="type-body-s ym-account-section__text">{t.notificationsHint}</p>
                </div>
                <div className="ym-account-section__fields">
                    {notifications.map((item) => (
                        <Checkbox
                            key={item.key}
                            label={t.notificationKinds[item.key] ?? item.key}
                            checked={prefs[item.key] ?? item.enabled}
                            onChange={(checked) => toggle(item.key, checked)}
                        />
                    ))}
                </div>
            </section>

            <section aria-label={t.delete} className="ym-account-section">
                <div className="ym-account-section__intro">
                    <h2 className="type-h3">{t.delete}</h2>
                    <p className="type-body-s ym-account-section__text">{t.deleteSoon}</p>
                </div>
                <div className="ym-account-section__fields">
                    <div>
                        <Button type="button" variant="outline" disabled>
                            {t.deleteButton}
                        </Button>
                    </div>
                </div>
            </section>
        </div>
    );
}

AccountProfile.layout = (page: ReactNode) => <AccountLayout active="profile">{page}</AccountLayout>;
