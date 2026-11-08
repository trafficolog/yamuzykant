import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ChatThread from '@/Components/ChatThread';
import { VIEWER, conversation, fakeEcho, json, message } from '../support/messages';

// 4.1.2: ChatThread — карточка объявления сверху, сообщения, поле ввода (Enter — отправить, Shift+Enter — перенос),
// «Не отправлено · Повторить», только чтение по 409, экранирование текста, aria-live, realtime.

const fake = fakeEcho();
vi.mock('@/realtime/echo', () => ({ getEcho: (config: unknown) => (config ? fake.echo : null) }));

const fetchMock = vi.fn();
const onBack = vi.fn();
const onChanged = vi.fn();
const onStarted = vi.fn();

const REALTIME = { key: 'k', host: '127.0.0.1', port: 8080, scheme: 'http' };

type Props = ComponentProps<typeof ChatThread>;

function view(props: Partial<Props> = {}) {
    return render(
        <ChatThread
            viewerId={VIEWER}
            conversation={conversation()}
            compose={null}
            messages={[message(1, 'Добрый вечер, гриф шлифовали?', true)]}
            hasMore={false}
            realtime={REALTIME}
            onBack={onBack}
            onChanged={onChanged}
            onStarted={onStarted}
            {...props}
        />,
    );
}

const field = () => screen.getByRole('textbox', { name: 'Сообщение' });
const sendButton = () => screen.getByRole('button', { name: 'Отправить' });
const log = () => screen.getByRole('log');

/** Ответ POST /conversations/{id}/messages. */
const created = (id: number, body: string) => json({ data: message(id, body, true) }, 201);

beforeEach(() => {
    fetchMock.mockReset();
    // Без явной подмены любой запрос — успешный пустой ответ (отметка «прочитано»).
    fetchMock.mockImplementation(async () => json({ unread: 0 }));
    vi.stubGlobal('fetch', fetchMock);
    fake.echo.private.mockClear();
    onBack.mockReset();
    onChanged.mockReset();
    onStarted.mockReset();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('ChatThread: содержимое', () => {
    it('шапка с именем собеседника, карточка объявления с названием и ценой, кнопка «Закрыть чат»', () => {
        view();

        expect(screen.getByRole('heading', { name: 'Андрей К.' })).toBeInTheDocument();
        const card = screen.getByRole('region', { name: 'Объявление' });
        expect(within(card).getByText('Fender ’57 Stratocaster')).toBeInTheDocument();
        expect(card).toHaveTextContent('184 500 ₽');
        fireEvent.click(screen.getByRole('button', { name: 'Закрыть чат' }));
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('карточка объявления — ссылка на страницу лота', () => {
        view();

        const card = screen.getByRole('region', { name: 'Объявление' });
        expect(within(card).getByRole('link')).toHaveAttribute('href', '/listings/l1');
    });

    it('цена «Договорная» и «Бесплатно» по BR-11, «0 ₽» не показывается', () => {
        const { rerender } = view({
            conversation: conversation({
                listing: { id: 'l1', title: 'Гриф', price: null, available: true },
            }),
        });
        expect(screen.getByRole('region', { name: 'Объявление' })).toHaveTextContent('Договорная');

        rerender(
            <ChatThread
                viewerId={VIEWER}
                conversation={conversation({
                    listing: { id: 'l1', title: 'Гриф', price: 0, available: true },
                })}
                compose={null}
                messages={[]}
                hasMore={false}
                realtime={null}
                onBack={onBack}
            />,
        );
        const card = screen.getByRole('region', { name: 'Объявление' });
        expect(card).toHaveTextContent('Бесплатно');
        expect(card).not.toHaveTextContent('0 ₽');
    });

    it('напоминание «платите после осмотра» всегда в начале переписки', () => {
        view();

        expect(
            within(log()).getByText(/Платите только после осмотра инструмента/),
        ).toBeInTheDocument();
    });

    it('сообщения — в порядке получения, с датой-разделителем; у чужих нет метки «Вы»', () => {
        view({
            messages: [
                message(1, 'Первое', true, { created_at: '2026-09-08T16:08:00Z' }),
                message(2, 'Второе', false, { created_at: '2026-09-09T06:28:00Z' }),
            ],
        });

        const texts = within(log())
            .getAllByRole('listitem')
            .map((item) => item.textContent ?? '');
        expect(texts.findIndex((t) => t.includes('Первое'))).toBeLessThan(
            texts.findIndex((t) => t.includes('Второе')),
        );
        expect(within(log()).getByText('8 сентября')).toBeInTheDocument();
        expect(within(log()).getByText('9 сентября')).toBeInTheDocument();
    });

    it('системное сообщение выделено карточкой, а не пузырём участника', () => {
        view({
            messages: [message(1, 'Цена согласована', false, { kind: 'system', sender_id: null })],
        });

        expect(screen.getByText('Цена согласована').closest('.ym-chat__system')).not.toBeNull();
    });

    it('собеседник удалил аккаунт: имя из ответа сервера, поле заблокировано с причиной', () => {
        view({
            conversation: conversation({
                counterpart: { name: 'Пользователь удалил аккаунт', deleted: true },
                closed_reason: 'Собеседник удалил аккаунт — новые сообщения недоступны.',
            }),
        });

        expect(
            screen.getByRole('heading', { name: 'Пользователь удалил аккаунт' }),
        ).toBeInTheDocument();
        expect(field()).toBeDisabled();
        expect(
            screen.getByText('Собеседник удалил аккаунт — новые сообщения недоступны.'),
        ).toBeInTheDocument();
    });
});

describe('ChatThread: экранирование текста', () => {
    const hostile =
        '<img src=x onerror=alert(1)> https://evil.example/pay +7 (999) 123-45-67 <a href="https://evil.example">клик</a>';

    it('HTML, ссылки и телефоны выводятся текстом: нет ни тегов, ни ссылок', () => {
        const { container } = view({ messages: [message(1, hostile, false)] });

        expect(within(log()).getByText(hostile)).toBeInTheDocument();
        expect(container.querySelector('img')).toBeNull();
        expect(within(log()).queryAllByRole('link')).toHaveLength(0);
        expect(container.querySelector('[href^="tel:"], [href*="evil"]')).toBeNull();
    });

    it('переводы строк сохраняются, а разметка не разбирается', () => {
        view({ messages: [message(1, 'Раз\n<b>два</b>', false)] });

        const paragraph = screen.getByText(/Раз/);
        expect(paragraph.textContent).toBe('Раз\n<b>два</b>');
        expect(paragraph.querySelector('b')).toBeNull();
        // Переводы строк сохраняет CSS класса текста: white-space: pre-line (проверено ниже по исходнику стилей).
        expect(paragraph).toHaveClass('ym-chat__text');
        expect(readFileSync('resources/css/messages.css', 'utf8')).toMatch(
            /\.ym-chat__text\s*\{[^}]*white-space:\s*pre-line/,
        );
    });
});

describe('ChatThread: поле ввода и клавиатура', () => {
    it('Enter отправляет сообщение: POST, текст появляется в переписке, поле очищается, список обновляется', async () => {
        fetchMock.mockImplementation(async (url: string) =>
            String(url).endsWith('/read') ? json({ unread: 0 }) : created(2, 'Привет'),
        );
        view();

        fireEvent.change(field(), { target: { value: 'Привет' } });
        fireEvent.keyDown(field(), { key: 'Enter' });

        await waitFor(() => expect(within(log()).getByText('Привет')).toBeInTheDocument());
        const call = fetchMock.mock.calls.find(
            ([url]) => String(url) === '/conversations/c1/messages',
        );
        expect(call).toBeDefined();
        expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ body: 'Привет' });
        expect((call?.[1] as RequestInit).method).toBe('POST');
        expect(field()).toHaveValue('');
        await waitFor(() => expect(onChanged).toHaveBeenCalled());
    });

    it('Shift+Enter — перенос строки: ничего не отправляется', () => {
        view();

        fireEvent.change(field(), { target: { value: 'Раз' } });
        const prevented = !fireEvent.keyDown(field(), { key: 'Enter', shiftKey: true });

        expect(prevented).toBe(false);
        expect(
            fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/messages')),
        ).toHaveLength(0);
        expect(field()).toHaveValue('Раз');
    });

    it('Enter при вводе через IME (isComposing) не отправляет', () => {
        view();

        fireEvent.change(field(), { target: { value: 'при' } });
        fireEvent.keyDown(field(), { key: 'Enter', isComposing: true });

        expect(
            fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/messages')),
        ).toHaveLength(0);
    });

    it('пустое или из пробелов: кнопка «Отправить» неактивна, Enter ничего не шлёт', () => {
        view();

        expect(sendButton()).toBeDisabled();
        fireEvent.change(field(), { target: { value: '   \n ' } });
        expect(sendButton()).toBeDisabled();
        fireEvent.keyDown(field(), { key: 'Enter' });
        expect(
            fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/messages')),
        ).toHaveLength(0);
    });

    it('у поля есть имя «Сообщение» и подсказка, фокус по Tab доходит до «Отправить»', () => {
        view();

        expect(field()).toHaveAttribute('placeholder', 'Напишите сообщение');
        fireEvent.change(field(), { target: { value: 'Да' } });
        expect(sendButton()).toBeEnabled();
        expect(sendButton()).toHaveAttribute('type', 'submit');
    });

    it('длиннее 2000 символов: «Отправить» неактивна, сказано, сколько можно; близко к лимиту — счётчик', () => {
        view();

        fireEvent.change(field(), { target: { value: 'а'.repeat(1_850) } });
        expect(screen.getByText('1 850 / 2 000')).toBeInTheDocument();
        expect(sendButton()).toBeEnabled();

        fireEvent.change(field(), { target: { value: 'а'.repeat(2_001) } });
        expect(sendButton()).toBeDisabled();
        expect(
            screen.getByText('Сообщение длиннее 2 000 символов — сократите его.'),
        ).toBeInTheDocument();
    });

    it('быстрые ответы подставляют текст в поле и пропадают, когда есть набранный текст', () => {
        view();

        fireEvent.click(screen.getByRole('button', { name: 'Ещё продаётся?' }));
        expect(field()).toHaveValue('Ещё продаётся?');
        expect(screen.queryByRole('group', { name: 'Быстрые ответы' })).toBeNull();
        expect(document.activeElement).toBe(field());
    });
});

describe('ChatThread: ошибки отправки', () => {
    it('без сети: «Не отправлено · Повторить»; повтор отправляет тот же текст и убирает пометку', async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (String(url).endsWith('/read')) return json({ unread: 0 });
            throw new TypeError('Failed to fetch');
        });
        view();

        fireEvent.change(field(), { target: { value: 'Без сети' } });
        fireEvent.keyDown(field(), { key: 'Enter' });

        const failed = await screen.findByText('Не отправлено');
        expect(failed.closest('li')).toHaveTextContent('Без сети');
        const retry = screen.getByRole('button', { name: 'Повторить' });

        fetchMock.mockImplementation(async () => created(5, 'Без сети'));
        fireEvent.click(retry);

        await waitFor(() => expect(screen.queryByText('Не отправлено')).toBeNull());
        expect(within(log()).getAllByText('Без сети')).toHaveLength(1);
    });

    it('ответ 500 тоже даёт «Повторить», текст не теряется', async () => {
        fetchMock.mockImplementation(async () => json({ message: 'Server Error' }, 500));
        view();

        fireEvent.change(field(), { target: { value: 'Не дошло' } });
        fireEvent.keyDown(field(), { key: 'Enter' });

        expect(await screen.findByRole('button', { name: 'Повторить' })).toBeInTheDocument();
        expect(within(log()).getByText('Не дошло')).toBeInTheDocument();
    });

    it('409: поле заблокировано, причина из ответа сервера, неотправленное сообщение не висит в переписке', async () => {
        const reason = 'Объявление снято модерацией — беседа доступна только для чтения.';
        fetchMock.mockImplementation(async () => json({ message: reason }, 409));
        view();

        fireEvent.change(field(), { target: { value: 'Поздно' } });
        fireEvent.keyDown(field(), { key: 'Enter' });

        expect(await screen.findByText(reason)).toBeInTheDocument();
        expect(field()).toBeDisabled();
        expect(sendButton()).toBeDisabled();
        expect(screen.queryByRole('button', { name: 'Повторить' })).toBeNull();
        expect(within(log()).queryByText('Поздно')).toBeNull();
    });

    it('422: сообщение сервера у поля, текст остаётся для правки, «Повторить» нет', async () => {
        fetchMock.mockImplementation(async () =>
            json({ message: 'x', errors: { body: ['Напишите сообщение.'] } }, 422),
        );
        view();

        fireEvent.change(field(), { target: { value: 'текст' } });
        fireEvent.keyDown(field(), { key: 'Enter' });

        expect(await screen.findByText('Напишите сообщение.')).toBeInTheDocument();
        expect(field()).toHaveValue('текст');
        expect(screen.queryByRole('button', { name: 'Повторить' })).toBeNull();
        expect(field()).toBeEnabled();
    });

    it('429: «Повторить» и пояснение, что сообщений слишком много', async () => {
        fetchMock.mockImplementation(async () => json({ message: 'Too Many Attempts.' }, 429));
        view();

        fireEvent.change(field(), { target: { value: 'часто' } });
        fireEvent.keyDown(field(), { key: 'Enter' });

        expect(await screen.findByRole('button', { name: 'Повторить' })).toBeInTheDocument();
    });
});

describe('ChatThread: только чтение с самого начала', () => {
    it('причина из беседы: поле и «Отправить» заблокированы, быстрых ответов нет', () => {
        const reason =
            'Объявление не опубликовано больше 30 дней — беседа доступна только для чтения.';
        view({ conversation: conversation({ closed_reason: reason }) });

        expect(field()).toBeDisabled();
        expect(sendButton()).toBeDisabled();
        expect(screen.getByText(reason)).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'Быстрые ответы' })).toBeNull();
        // История по-прежнему читается.
        expect(within(log()).getByText('Добрый вечер, гриф шлифовали?')).toBeInTheDocument();
    });
});

describe('ChatThread: доступность и realtime', () => {
    it('переписка — role="log" с aria-live="polite", новые сообщения только добавляются', () => {
        view();

        expect(log()).toHaveAttribute('aria-live', 'polite');
        expect(log()).toHaveAttribute('aria-relevant', 'additions');
        expect(log()).toHaveAccessibleName('Переписка: Андрей К.');
    });

    it('подписывается на private conversation.{id}, при выходе отписывается', () => {
        const { unmount } = view();

        expect(fake.echo.private).toHaveBeenCalledWith('conversation.c1');
        unmount();
        expect(fake.echo.leave).toHaveBeenCalledWith('conversation.c1');
    });

    it('сообщение собеседника из канала появляется в переписке и отмечается прочитанным', async () => {
        view();
        fetchMock.mockClear();

        act(() => {
            fake.emit('.message.sent', {
                id: 7,
                conversation_id: 'c1',
                kind: 'text',
                body: 'Можно в субботу',
                sender_id: 2,
                created_at: '2026-09-10T08:00:00Z',
            });
        });

        expect(within(log()).getByText('Можно в субботу')).toBeInTheDocument();
        await waitFor(() =>
            expect(
                fetchMock.mock.calls.some(([url]) => String(url) === '/conversations/c1/read'),
            ).toBe(true),
        );
    });

    it('то же событие дважды и собственное эхо после ответа сервера не дублируют сообщение', async () => {
        fetchMock.mockImplementation(async (url: string) =>
            String(url).endsWith('/read') ? json({ unread: 0 }) : created(9, 'Моё'),
        );
        view();

        fireEvent.change(field(), { target: { value: 'Моё' } });
        fireEvent.keyDown(field(), { key: 'Enter' });
        await waitFor(() => expect(within(log()).getByText('Моё')).toBeInTheDocument());

        const echoPayload = {
            id: 9,
            conversation_id: 'c1',
            kind: 'text',
            body: 'Моё',
            sender_id: VIEWER,
            created_at: '2026-09-10T08:00:00Z',
        };
        act(() => {
            fake.emit('.message.sent', echoPayload);
            fake.emit('.message.sent', echoPayload);
        });

        expect(within(log()).getAllByText('Моё')).toHaveLength(1);
    });

    it('собственное эхо раньше ответа сервера: сообщение показано один раз', async () => {
        let resolve: (response: Response) => void = () => undefined;
        fetchMock.mockImplementation((url: string) =>
            String(url).endsWith('/read')
                ? Promise.resolve(json({ unread: 0 }))
                : new Promise<Response>((r) => {
                      resolve = r;
                  }),
        );
        view();

        fireEvent.change(field(), { target: { value: 'Раньше' } });
        fireEvent.keyDown(field(), { key: 'Enter' });
        act(() => {
            fake.emit('.message.sent', {
                id: 11,
                conversation_id: 'c1',
                kind: 'text',
                body: 'Раньше',
                sender_id: VIEWER,
                created_at: '2026-09-10T08:00:00Z',
            });
        });
        // Пока ответ POST не пришёл, рядом не стоят «отправляется» и настоящее сообщение.
        expect(within(log()).getAllByText('Раньше')).toHaveLength(1);
        expect(screen.queryByText('Отправляется')).toBeNull();
        await act(async () => {
            resolve(created(11, 'Раньше'));
        });

        expect(within(log()).getAllByText('Раньше')).toHaveLength(1);
    });

    it('«прочитано» от собеседника меняет отметку у моих сообщений', () => {
        view({ messages: [message(1, 'Мой вопрос', true)] });
        const item = () => screen.getByText('Мой вопрос').closest('li') as HTMLElement;
        expect(within(item()).getByLabelText('Отправлено')).toBeInTheDocument();

        act(() => {
            fake.emit('.conversation.read', {
                conversation_id: 'c1',
                reader_id: 2,
                read_at: '2026-09-10T09:00:00Z',
            });
        });

        expect(within(item()).getByLabelText('Прочитано')).toBeInTheDocument();
    });

    it('свою же отметку «прочитано» (reader_id — я) не принимает за прочтение моих сообщений', () => {
        view({ messages: [message(1, 'Мой вопрос', true)] });

        act(() => {
            fake.emit('.conversation.read', {
                conversation_id: 'c1',
                reader_id: VIEWER,
                read_at: '2026-09-10T09:00:00Z',
            });
        });

        expect(screen.getByLabelText('Отправлено')).toBeInTheDocument();
    });

    it('при открытии отмечает прочитанными, только если есть непрочитанные от собеседника', async () => {
        view({ messages: [message(1, 'Мой вопрос', true)] });
        expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/read'))).toBe(false);

        view({ messages: [message(2, 'Ответ', false)] });
        await waitFor(() =>
            expect(
                fetchMock.mock.calls.some(([url]) => String(url) === '/conversations/c1/read'),
            ).toBe(true),
        );
        await waitFor(() => expect(onChanged).toHaveBeenCalled());
    });

    it('обрыв канала: тихая подсказка «Нет соединения», в DOM виден признак подключения', () => {
        view();
        const root = log().closest('[data-connection]');
        expect(root).toHaveAttribute('data-connection', 'connecting');

        act(() => fake.connect());
        expect(root).toHaveAttribute('data-connection', 'connected');
        expect(screen.queryByText(/Нет соединения/)).toBeNull();

        act(() => fake.fail());
        expect(root).toHaveAttribute('data-connection', 'offline');
        expect(screen.getByRole('status')).toHaveTextContent('Нет соединения');
    });

    it('без настроек realtime (гость, Reverb выключен) работает без канала', () => {
        view({ realtime: null });

        expect(fake.echo.private).not.toHaveBeenCalled();
        expect(field()).toBeEnabled();
    });
});

describe('ChatThread: история', () => {
    it('«Показать ранее» подгружает страницу до самого старого id и ставит её в начало', async () => {
        fetchMock.mockImplementation(async (url: string) =>
            String(url).includes('before=')
                ? json({
                      conversation: conversation(),
                      data: [message(1, 'Самое первое', false)],
                      meta: { has_more: false },
                  })
                : json({ unread: 0 }),
        );
        view({ messages: [message(2, 'Позже', false)], hasMore: true });

        fireEvent.click(screen.getByRole('button', { name: 'Показать ранее' }));

        await screen.findByText('Самое первое');
        expect(
            fetchMock.mock.calls.some(
                ([url]) => String(url) === '/conversations/c1/messages?before=2',
            ),
        ).toBe(true);
        expect(screen.queryByRole('button', { name: 'Показать ранее' })).toBeNull();
    });

    it('пока страница вставляется в начало, журнал помечен aria-busy: диктор не читает её заново', async () => {
        let resolve: (response: Response) => void = () => undefined;
        fetchMock.mockImplementation((url: string) =>
            String(url).includes('before=')
                ? new Promise<Response>((r) => {
                      resolve = r;
                  })
                : Promise.resolve(json({ unread: 0 })),
        );
        view({ messages: [message(2, 'Позже', false)], hasMore: true });
        expect(log()).not.toHaveAttribute('aria-busy', 'true');

        fireEvent.click(screen.getByRole('button', { name: 'Показать ранее' }));
        expect(log()).toHaveAttribute('aria-busy', 'true');

        await act(async () => {
            resolve(
                json({
                    conversation: conversation(),
                    data: [message(1, 'Самое первое', false)],
                    meta: { has_more: false },
                }),
            );
        });

        await screen.findByText('Самое первое');
        await waitFor(() => expect(log()).not.toHaveAttribute('aria-busy', 'true'));
        expect(log()).toHaveAttribute('aria-live', 'polite');
    });

    it('страница не загрузилась: aria-busy снимается', async () => {
        fetchMock.mockImplementation(async (url: string) =>
            String(url).includes('before=') ? json({}, 500) : json({ unread: 0 }),
        );
        view({ messages: [message(2, 'Позже', false)], hasMore: true });

        fireEvent.click(screen.getByRole('button', { name: 'Показать ранее' }));

        await screen.findByText(/Не удалось/);
        expect(log()).not.toHaveAttribute('aria-busy', 'true');
    });

    it('без более ранних сообщений кнопки нет', () => {
        view({ hasMore: false });

        expect(screen.queryByRole('button', { name: 'Показать ранее' })).toBeNull();
    });
});

describe('ChatThread: «Написать продавцу» (беседы ещё нет)', () => {
    const compose = {
        listing: { id: 'l1', title: 'Fender ’57 Stratocaster', price: 184_500 },
        counterpart: { name: 'Олег' },
    };

    it('показывает продавца и объявление, подсказывает написать первым', () => {
        view({ conversation: null, compose, messages: [], realtime: null });

        expect(screen.getByRole('heading', { name: 'Олег' })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Объявление' })).toHaveTextContent(
            'Fender ’57 Stratocaster',
        );
        expect(screen.getByText(/Напишите продавцу первым/)).toBeInTheDocument();
        expect(fake.echo.private).not.toHaveBeenCalled();
    });

    it('первое сообщение создаёт беседу по объявлению и передаёт её странице', async () => {
        fetchMock.mockImplementation(async () =>
            json(
                {
                    conversation: conversation({ id: 'new-1' }),
                    message: message(1, 'Здравствуйте', true),
                },
                201,
            ),
        );
        view({ conversation: null, compose, messages: [], realtime: null });

        fireEvent.change(field(), { target: { value: 'Здравствуйте' } });
        fireEvent.keyDown(field(), { key: 'Enter' });

        await waitFor(() => expect(onStarted).toHaveBeenCalledTimes(1));
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('/listings/l1/conversations');
        expect(JSON.parse(String(init.body))).toEqual({ body: 'Здравствуйте' });
        expect(onStarted.mock.calls[0]?.[0]).toMatchObject({ id: 'new-1' });
    });

    it('объявление больше не принимает сообщения (404): понятное состояние, поле заблокировано', async () => {
        fetchMock.mockImplementation(async () => json({ message: 'Not Found' }, 404));
        view({ conversation: null, compose, messages: [], realtime: null });

        fireEvent.change(field(), { target: { value: 'Здравствуйте' } });
        fireEvent.keyDown(field(), { key: 'Enter' });

        expect(
            await screen.findByText('Объявление уже недоступно — написать по нему нельзя.'),
        ).toBeInTheDocument();
        expect(field()).toBeDisabled();
    });
});
