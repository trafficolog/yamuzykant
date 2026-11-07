import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LoginDialog, { type LoginDialogProps } from '@/Components/LoginDialog';
import { ru } from '@/lang/ru';

const { visit } = vi.hoisted(() => ({ visit: vi.fn() }));

vi.mock('@inertiajs/react', () => ({
    router: { visit, on: vi.fn() },
    usePage: () => ({ props: { flags: {} } }),
}));

const MOSCOW = { id: 2, name: 'Москва' };
const CITIES = [
    { id: 1, name: 'Казань', region: 'Татарстан' },
    { id: 2, name: 'Москва', region: 'Москва' },
];
const CANCELLED = 'Вход через Яндекс ID отменён. Войдите по почте или попробуйте ещё раз';
const THROTTLED = 'Слишком много попыток. Повторите через 15 мин';

type Reply = { status: number; body: unknown };
const replies = new Map<string, Reply[]>();
const fetchMock = vi.fn();

/** Очередь ответов сервера на адрес: ответы отдаются по порядку, последний повторяется. */
const reply = (url: string, status: number, body: unknown = {}) => {
    replies.set(url, [...(replies.get(url) ?? []), { status, body }]);
};
const calls = (url: string) =>
    fetchMock.mock.calls
        .filter(([target]) => String(target).split('?')[0] === url)
        .map(([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? 'null')));

/** Переход Inertia завершается сразу: окно закрывается по onFinish. */
const finishVisitsAtOnce = () =>
    visit.mockImplementation((_url: string, options?: { onFinish?: () => void }) =>
        options?.onFinish?.(),
    );

beforeEach(() => {
    visit.mockReset();
    fetchMock.mockReset();
    replies.clear();
    reply('/cities', 200, { data: CITIES });
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
        const url = String(input).split('?')[0] ?? '';
        const queue = replies.get(url) ?? [{ status: 404, body: {} }];
        const next = queue.length > 1 ? queue.shift() : queue[0];
        const { status, body } = next ?? { status: 404, body: {} };
        return Promise.resolve({
            ok: status >= 200 && status < 300,
            status,
            json: () => Promise.resolve(body),
        } as Response);
    });
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.style.overflow = '';
});

/** Страница с кнопкой «Войти»: окно открывается с неё и при закрытии возвращает на неё фокус. */
function Page(props: Partial<LoginDialogProps>) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" id="site-login-toggle" onClick={() => setOpen(true)}>
                Войти
            </button>
            {open ? (
                <LoginDialog
                    city={MOSCOW}
                    returnTo="/baraholka?page=2"
                    onClose={() => setOpen(false)}
                    {...props}
                />
            ) : null}
        </>
    );
}

const openFromButton = (props: Partial<LoginDialogProps> = {}) => {
    render(<Page {...props} />);
    const opener = screen.getByRole('button', { name: 'Войти' });
    opener.focus();
    fireEvent.click(opener);
    return opener;
};

const dialog = () => screen.getByRole('dialog');
const emailField = () => screen.getByLabelText(ru.login.emailLabel);
const codeField = () => screen.getByLabelText(ru.login.codeLabel);

const submitEmail = async (address = 'anna@example.com') => {
    fireEvent.change(emailField(), { target: { value: address } });
    fireEvent.click(screen.getByRole('button', { name: ru.login.getCode }));
    await screen.findByLabelText(ru.login.codeLabel);
};

describe('LoginDialog: шаг «Способ»', () => {
    it('открыт как модальный диалог с заголовком «Вход», фокус в поле почты', () => {
        openFromButton();

        expect(dialog()).toHaveAttribute('aria-modal', 'true');
        expect(dialog()).toHaveAccessibleName('Вход');
        expect(emailField()).toHaveFocus();
    });

    it('«Войти с Яндекс ID» ведёт на OAuth с относительным адресом возврата', () => {
        openFromButton();

        const link = within(dialog()).getByRole('link', { name: 'Войти с Яндекс ID' });
        expect(link).toHaveAttribute(
            'href',
            `/auth/yandex/redirect?return=${encodeURIComponent('/baraholka?page=2')}`,
        );
    });

    it('чужой или абсолютный адрес возврата заменяется главной', () => {
        openFromButton({ returnTo: 'https://evil.example/steal' });

        const link = within(dialog()).getByRole('link', { name: 'Войти с Яндекс ID' });
        expect(link).toHaveAttribute('href', '/auth/yandex/redirect?return=%2F');
    });

    it('блокирует прокрутку страницы, пока окно открыто', () => {
        openFromButton();
        expect(document.body.style.overflow).toBe('hidden');

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(document.body.style.overflow).toBe('');
    });
});

describe('LoginDialog: фокус и клавиатура', () => {
    it('Esc закрывает окно, фокус возвращается на кнопку «Войти»', () => {
        const opener = openFromButton();

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(opener).toHaveFocus();
    });

    it('кнопка «Закрыть» закрывает окно и возвращает фокус', () => {
        const opener = openFromButton();

        fireEvent.click(within(dialog()).getByRole('button', { name: ru.login.close }));

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(opener).toHaveFocus();
    });

    it('Tab с последнего элемента переходит на первый, Shift+Tab с первого — на последний', () => {
        openFromButton();
        const focusable = Array.from(
            dialog().querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input'),
        );
        const first = focusable[0] as HTMLElement;
        const last = focusable[focusable.length - 1] as HTMLElement;

        last.focus();
        fireEvent.keyDown(last, { key: 'Tab' });
        expect(first).toHaveFocus();

        first.focus();
        fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
        expect(last).toHaveFocus();
    });

    it('фокус, ушедший за пределы окна, возвращается внутрь', () => {
        openFromButton();
        const outside = screen.getByRole('button', { name: 'Войти', hidden: true });

        act(() => outside.focus());

        expect(dialog().contains(document.activeElement)).toBe(true);
    });
});

describe('LoginDialog: вход по почте', () => {
    it('«Получить код» отправляет почту и открывает шаг «Код»', async () => {
        reply('/auth/email/code', 202, { status: 'code_sent', expires_in: 600 });
        openFromButton();

        await submitEmail();

        expect(calls('/auth/email/code')).toEqual([{ email: 'anna@example.com' }]);
        expect(dialog()).toHaveAccessibleName('Введите код');
        expect(within(dialog()).getByText(/anna@example\.com/)).toBeInTheDocument();
        expect(codeField()).toHaveFocus();
    });

    it('«Изменить почту» возвращает на шаг «Способ» с введённым адресом', async () => {
        reply('/auth/email/code', 202, { status: 'code_sent', expires_in: 600 });
        openFromButton();
        await submitEmail();

        fireEvent.click(screen.getByRole('button', { name: ru.login.changeEmail }));

        expect(emailField()).toHaveValue('anna@example.com');
        expect(emailField()).toHaveFocus();
    });

    it('ошибка почты показана у поля текстом сервера', async () => {
        reply('/auth/email/code', 422, {
            message: 'x',
            errors: { email: ['Проверьте адрес почты: в нём должен быть знак @ и домен'] },
        });
        openFromButton();

        fireEvent.change(emailField(), { target: { value: 'anna' } });
        fireEvent.click(screen.getByRole('button', { name: ru.login.getCode }));

        expect(
            await screen.findByText('Проверьте адрес почты: в нём должен быть знак @ и домен'),
        ).toBeInTheDocument();
        expect(emailField()).toHaveAttribute('aria-invalid', 'true');
    });

    it('сеть недоступна: понятная ошибка, поле остаётся доступным', async () => {
        fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('offline')));
        openFromButton();

        fireEvent.change(emailField(), { target: { value: 'anna@example.com' } });
        fireEvent.click(screen.getByRole('button', { name: ru.login.getCode }));

        expect(await screen.findByText(ru.login.networkError)).toBeInTheDocument();
        expect(emailField()).not.toBeDisabled();
    });

    it('шестая цифра отправляет код сама; вход возвращает к прерванному действию', async () => {
        const onAuthenticated = vi.fn();
        reply('/auth/email/code', 202, { status: 'code_sent', expires_in: 600 });
        reply('/auth/email/verify', 200, { status: 'authenticated', redirect: '/' });
        finishVisitsAtOnce();
        openFromButton({ onAuthenticated });
        await submitEmail();

        fireEvent.change(codeField(), { target: { value: '12345' } });
        expect(calls('/auth/email/verify')).toEqual([]);
        fireEvent.change(codeField(), { target: { value: '123456' } });

        await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
        expect(calls('/auth/email/verify')).toEqual([
            { email: 'anna@example.com', code: '123456' },
        ]);
        expect(visit).toHaveBeenCalledWith(
            '/baraholka?page=2',
            expect.objectContaining({ preserveScroll: true }),
        );
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('адрес возврата с сервера (url.intended) главнее текущей страницы', async () => {
        reply('/auth/email/code', 202, { status: 'code_sent', expires_in: 600 });
        reply('/auth/email/verify', 200, { status: 'authenticated', redirect: '/lot/7' });
        finishVisitsAtOnce();
        openFromButton();
        await submitEmail();

        fireEvent.change(codeField(), { target: { value: '123456' } });

        await waitFor(() => expect(visit).toHaveBeenCalled());
        expect(visit.mock.calls[0]?.[0]).toBe('/lot/7');
    });

    it('неверный код: текст ошибки у поля, поле очищено и в фокусе', async () => {
        reply('/auth/email/code', 202, { status: 'code_sent', expires_in: 600 });
        reply('/auth/email/verify', 422, {
            message: 'x',
            errors: { code: [ru.login.invalidCode] },
        });
        openFromButton();
        await submitEmail();

        fireEvent.change(codeField(), { target: { value: '000000' } });

        expect(await screen.findByText(ru.login.invalidCode)).toBeInTheDocument();
        expect(codeField()).toHaveValue('');
        expect(codeField()).toHaveAttribute('aria-invalid', 'true');
        expect(codeField()).toHaveFocus();
    });

    it('блок: текст сервера в сообщении, ввод и отправка недоступны', async () => {
        reply('/auth/email/code', 202, { status: 'code_sent', expires_in: 600 });
        reply('/auth/email/verify', 429, { message: THROTTLED, retry_after: 900 });
        openFromButton();
        await submitEmail();

        fireEvent.change(codeField(), { target: { value: '000000' } });

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent(THROTTLED);
        expect(codeField()).toBeDisabled();
        expect(screen.getByRole('button', { name: ru.login.signIn })).toBeDisabled();
    });

    it('блок снимается по истечении retry_after', async () => {
        vi.useFakeTimers();
        reply('/auth/email/code', 429, { message: THROTTLED, retry_after: 30 });
        openFromButton();

        fireEvent.change(emailField(), { target: { value: 'anna@example.com' } });
        fireEvent.click(screen.getByRole('button', { name: ru.login.getCode }));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(screen.getByRole('alert')).toHaveTextContent(THROTTLED);
        expect(screen.getByRole('button', { name: ru.login.getCode })).toBeDisabled();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(31_000);
        });

        expect(screen.queryByRole('alert')).toBeNull();
        expect(screen.getByRole('button', { name: ru.login.getCode })).toBeEnabled();
    });

    it('повторная отправка недоступна 60 с, потом шлёт код ещё раз', async () => {
        vi.useFakeTimers();
        reply('/auth/email/code', 202, { status: 'code_sent', expires_in: 600 });
        openFromButton();

        fireEvent.change(emailField(), { target: { value: 'anna@example.com' } });
        fireEvent.click(screen.getByRole('button', { name: ru.login.getCode }));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(screen.getByText(ru.login.resendIn(60))).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: ru.login.resend })).toBeNull();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(59_000);
        });
        expect(screen.getByText(ru.login.resendIn(1))).toBeInTheDocument();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1_000);
        });
        fireEvent.click(screen.getByRole('button', { name: ru.login.resend }));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(calls('/auth/email/code')).toHaveLength(2);
        expect(screen.getByText(ru.login.resendIn(60))).toBeInTheDocument();
    });
});

describe('LoginDialog: первый вход', () => {
    const toFirstLogin = async (suggestedName: string | null = 'Анна') => {
        reply('/auth/email/code', 202, { status: 'code_sent', expires_in: 600 });
        reply('/auth/email/verify', 200, { status: 'registration_required', name: suggestedName });
        openFromButton();
        await submitEmail();
        fireEvent.change(codeField(), { target: { value: '123456' } });
        await screen.findByLabelText(ru.login.nameLabel);
    };
    const proceed = () => screen.getByRole('button', { name: ru.login.proceed });

    it('имя из Яндекс ID подставлено, согласия нет: «Продолжить» неактивна, над ней — что не заполнено', async () => {
        await toFirstLogin('Анна');

        expect(dialog()).toHaveAccessibleName('Первый вход');
        expect(screen.getByLabelText(ru.login.nameLabel)).toHaveValue('Анна');
        expect(proceed()).toBeDisabled();
        expect(dialog()).toHaveTextContent('Не заполнено: согласие с правилами');
    });

    it('без имени в списке недостающего и имя, и согласие', async () => {
        await toFirstLogin(null);

        expect(dialog()).toHaveTextContent('Не заполнено: имя, согласие с правилами');
    });

    it('согласие со ссылками на правила и политику; с отметкой кнопка активна, подсказки нет', async () => {
        await toFirstLogin('Анна');

        const consent = screen.getByRole('checkbox');
        expect(
            within(dialog()).getByRole('link', { name: ru.login.consentRules }),
        ).toBeInTheDocument();
        expect(
            within(dialog()).getByRole('link', { name: ru.login.consentPolicy }),
        ).toBeInTheDocument();

        fireEvent.click(consent);

        expect(proceed()).toBeEnabled();
        expect(dialog()).not.toHaveTextContent('Не заполнено');
    });

    it('город по умолчанию из шапки уходит вместе с именем и согласием', async () => {
        await toFirstLogin('Анна');
        reply('/auth/register', 200, { status: 'authenticated', redirect: '/' });
        finishVisitsAtOnce();

        expect(screen.getByRole('button', { name: /Москва/ })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(proceed());

        await waitFor(() => expect(calls('/auth/register')).toHaveLength(1));
        expect(calls('/auth/register')[0]).toEqual({ name: 'Анна', city_id: 2, consent: true });
        await waitFor(() => expect(visit).toHaveBeenCalled());
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('город меняется компонентом выбора из шапки: выбор виден на форме и уходит на сервер', async () => {
        await toFirstLogin('Анна');
        reply('/auth/register', 200, { status: 'authenticated', redirect: '/' });
        finishVisitsAtOnce();

        fireEvent.click(screen.getByRole('button', { name: /Москва/ }));
        expect(dialog()).toHaveAccessibleName(ru.city.label);
        fireEvent.click(await screen.findByRole('button', { name: 'Казань' }));

        expect(dialog()).toHaveAccessibleName('Первый вход');
        expect(screen.getByRole('button', { name: /Казань/ })).toBeInTheDocument();
        expect(screen.getByLabelText(ru.login.nameLabel)).toHaveValue('Анна');

        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(proceed());

        await waitFor(() => expect(calls('/auth/register')).toHaveLength(1));
        expect(calls('/auth/register')[0]).toMatchObject({ city_id: 1 });
    });

    it('Esc в выборе города возвращает к форме, а не закрывает окно', async () => {
        await toFirstLogin('Анна');

        fireEvent.click(screen.getByRole('button', { name: /Москва/ }));
        fireEvent.keyDown(document, { key: 'Escape' });

        expect(dialog()).toHaveAccessibleName('Первый вход');
    });

    it('ошибки сервера показаны у полей', async () => {
        await toFirstLogin(null);
        reply('/auth/register', 422, {
            message: 'x',
            errors: { name: ['Укажите имя'] },
        });

        fireEvent.change(screen.getByLabelText(ru.login.nameLabel), { target: { value: ' ' } });
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(proceed());

        expect(await screen.findByText('Укажите имя')).toBeInTheDocument();
        expect(screen.getByLabelText(ru.login.nameLabel)).toHaveAttribute('aria-invalid', 'true');
    });

    it('сессия регистрации потеряна (409): возврат на «Способ» с текстом сервера', async () => {
        await toFirstLogin('Анна');
        reply('/auth/register', 409, { message: 'Подтвердите почту: запросите код ещё раз' });

        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(proceed());

        expect(
            await screen.findByText('Подтвердите почту: запросите код ещё раз'),
        ).toBeInTheDocument();
        expect(dialog()).toHaveAccessibleName('Вход');
    });
});

describe('LoginDialog: итог Яндекс ID', () => {
    it('отказ в Яндексе: текст из сервера и вход по почте остаётся', () => {
        render(
            <LoginDialog
                city={MOSCOW}
                returnTo="/"
                outcome={{ status: 'yandex_cancelled', message: CANCELLED }}
                onClose={() => {}}
            />,
        );

        expect(screen.getByRole('alert')).toHaveTextContent(CANCELLED);
        expect(emailField()).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Войти с Яндекс ID' })).toBeInTheDocument();
    });

    it('первый вход через Яндекс: сразу шаг «Первый вход» с именем из Яндекс ID', () => {
        render(
            <LoginDialog
                city={MOSCOW}
                returnTo="/"
                outcome={{ status: 'registration_required', name: 'Анна Тестова' }}
                onClose={() => {}}
            />,
        );

        expect(dialog()).toHaveAccessibleName('Первый вход');
        expect(screen.getByLabelText(ru.login.nameLabel)).toHaveValue('Анна Тестова');
    });

    it('Яндекс не отдал почту: шаг «Укажите почту» без кнопки Яндекса, код уходит на адреса Яндекс-входа', async () => {
        reply('/auth/yandex/email/code', 202, { status: 'code_sent', expires_in: 600 });
        reply('/auth/yandex/email/verify', 200, {
            status: 'registration_required',
            name: 'Анна',
        });
        render(
            <LoginDialog
                city={MOSCOW}
                returnTo="/"
                outcome={{ status: 'email_required' }}
                onClose={() => {}}
            />,
        );

        expect(dialog()).toHaveAccessibleName('Укажите почту');
        expect(screen.queryByRole('link', { name: 'Войти с Яндекс ID' })).toBeNull();

        await submitEmail();
        fireEvent.change(codeField(), { target: { value: '123456' } });

        await screen.findByLabelText(ru.login.nameLabel);
        expect(calls('/auth/yandex/email/code')).toEqual([{ email: 'anna@example.com' }]);
        expect(calls('/auth/yandex/email/verify')).toEqual([
            { email: 'anna@example.com', code: '123456' },
        ]);
        expect(calls('/auth/email/code')).toEqual([]);
    });
});
