import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ListingPhoto } from '@/Components/photoUploaderApi';
import SellCreate from '@/Pages/Sell/Create';

// UC-L1 п. 1–6 (задача 2.1.3): форма «Продать инструмент» — 4 шага, превью, список недостающего.

const NBSP = ' ';
const post = vi.fn();
let shared: Record<string, unknown> = {};

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: shared }),
    Head: () => null,
    router: { post: (...args: unknown[]) => post(...args) },
}));

const KINDS = [
    'Гитары',
    'Педали и усилители',
    'Клавишные',
    'Студия и запись',
    'Ударные',
    'Духовые',
    'Смычковые',
    'DJ',
];

const categories = KINDS.map((name, index) => ({
    id: index + 1,
    name,
    slug: `kind-${index + 1}`,
    icon: 'guitar',
    // У «Педалей и усилителей» (id 2) есть группа и пункт: модель из справочника лежит в пункте.
    children:
        index === 1
            ? [
                  {
                      id: 21,
                      name: 'Педали эффектов',
                      slug: 'pedali',
                      icon: null,
                      children: [{ id: 211, name: 'Фузз', slug: 'fuzz', icon: null, children: [] }],
                  },
              ]
            : [],
}));

function photo(id: number, overrides: Partial<ListingPhoto> = {}): ListingPhoto {
    return {
        id,
        position: id,
        is_serial: false,
        state: 'ready',
        error: null,
        urls: {
            square: {
                avif: `/media/photos/${id}/square.avif`,
                webp: `/media/photos/${id}/square.webp`,
            },
            wide: { avif: `/media/photos/${id}/wide.avif`, webp: `/media/photos/${id}/wide.webp` },
        },
        ...overrides,
    };
}

const THREE = [photo(1, { is_serial: true, urls: null }), photo(2), photo(3)];

function renderSell(props: Partial<React.ComponentProps<typeof SellCreate>> = {}) {
    return render(
        <SellCreate
            listingId="9f1c-listing"
            photos={[]}
            saved={false}
            place={{ type: 'г.', name: 'Москва' }}
            {...props}
        />,
    );
}

const missing = () => screen.queryByText(/^Чтобы опубликовать, добавьте:/);
const publish = () => screen.getByRole('button', { name: 'Опубликовать' });
const modelField = () => screen.getByRole('combobox', { name: 'Бренд и модель' });

function fillRequired() {
    fireEvent.change(modelField(), { target: { value: 'Fender Stratocaster' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Отличное' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Цена' }), {
        target: { value: '184500' },
    });
}

beforeEach(() => {
    post.mockReset();
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) })),
    );
    shared = {
        flags: {},
        categories,
        city: { id: 1, name: 'Москва' },
        errors: {},
    };
});

describe('Шаги и поля', () => {
    it('четыре шага на одной странице с заголовками из макета', () => {
        renderSell();

        expect(screen.getByRole('heading', { level: 1, name: 'Продать инструмент' })).toBeVisible();
        for (const [step, title] of [
            ['Шаг 1 из 4', 'Что продаёте'],
            ['Шаг 2 из 4', 'Фото'],
            ['Шаг 3 из 4', 'Состояние и описание'],
            ['Шаг 4 из 4', 'Цена и получение'],
        ] as const) {
            expect(screen.getByText(step)).toBeVisible();
            expect(screen.getByRole('heading', { level: 2, name: title })).toBeVisible();
        }
    });

    it('8 видов инструмента из справочника; выбран первый', () => {
        renderSell();

        const kinds = within(
            screen.getByRole('radiogroup', { name: 'Вид инструмента' }),
        ).getAllByRole('radio');
        expect(kinds.map((kind) => kind.textContent?.trim())).toEqual(KINDS);
        expect(kinds[0]).toHaveAttribute('aria-checked', 'true');

        fireEvent.click(screen.getByRole('radio', { name: 'Ударные' }));
        expect(screen.getByRole('radio', { name: 'Ударные' })).toHaveAttribute(
            'aria-checked',
            'true',
        );
        expect(kinds[0]).toHaveAttribute('aria-checked', 'false');
    });

    it('состояние: 8 ступеней и пояснение выбранной', () => {
        renderSell();

        const grades = within(screen.getByRole('radiogroup', { name: 'Состояние' })).getAllByRole(
            'radio',
        );
        expect(grades.map((grade) => grade.textContent)).toEqual([
            'Новое',
            'Как новое',
            'Отличное',
            'Очень хорошее',
            'Хорошее',
            'Удовлетворительное',
            'Плохое',
            'На запчасти',
        ]);
        expect(
            screen.getByText('Выберите по шкале — покупатели сравнивают лоты по ней.'),
        ).toBeVisible();

        fireEvent.click(screen.getByRole('radio', { name: 'Хорошее' }));
        expect(screen.getByText('Заметные следы игры, всё работает.')).toBeVisible();
    });

    it('поля: бренд и модель, год, серийный номер, описание, цена', () => {
        renderSell();

        expect(modelField()).toBeVisible();
        expect(screen.getByRole('textbox', { name: 'Год выпуска' })).toBeVisible();
        expect(screen.getByRole('textbox', { name: 'Серийный номер' })).toBeVisible();
        expect(screen.getByText('Покупатели не увидят его целиком')).toBeVisible();
        expect(screen.getByRole('textbox', { name: 'Описание' })).toBeVisible();
        expect(screen.getByRole('textbox', { name: 'Цена' })).toBeVisible();
    });

    it('способы передачи: встреча в городе шапки и доставка в защитной упаковке, оба включены; «Готов к торгу»', () => {
        renderSell();

        expect(screen.getByRole('button', { name: 'Встреча в г. Москва' })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        expect(
            screen.getByRole('button', { name: 'Доставка в защитной упаковке' }),
        ).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Готов к торгу' })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
    });

    it('в блоке фото — загрузчик с ячейкой «Серийный номер»', () => {
        renderSell();

        expect(screen.getByRole('button', { name: 'Добавить фото: Серийный номер' })).toBeVisible();
    });
});

describe('Встреча: тип населённого пункта без склонения (решение OWNER 08.11.2026)', () => {
    it('«Встреча в г. Москва»', () => {
        renderSell();

        expect(screen.getByRole('button', { name: 'Встреча в г. Москва' })).toBeVisible();
    });

    it('другой тип: «Встреча в пос. Заречье»', () => {
        renderSell({ place: { type: 'пос.', name: 'Заречье' } });

        expect(screen.getByRole('button', { name: 'Встреча в пос. Заречье' })).toBeVisible();
    });

    it('города нет: «Встреча в городе»', () => {
        renderSell({ place: null });

        expect(screen.getByRole('button', { name: 'Встреча в городе' })).toBeVisible();
    });
});

describe('Цена', () => {
    it('форматируется «184 500»', () => {
        renderSell();
        const price = screen.getByRole('textbox', { name: 'Цена' });

        fireEvent.change(price, { target: { value: '184500' } });

        expect(price).toHaveValue(`184${NBSP}500`);
    });

    it('ввод букв игнорируется', () => {
        renderSell();
        const price = screen.getByRole('textbox', { name: 'Цена' });

        fireEvent.change(price, { target: { value: 'abc' } });
        expect(price).toHaveValue('');

        fireEvent.change(price, { target: { value: 'a1b8c4d5e0f0' } });
        expect(price).toHaveValue(`184${NBSP}500`);
    });

    it('цифровая клавиатура на телефоне, суффикс ₽', () => {
        renderSell();

        expect(screen.getByRole('textbox', { name: 'Цена' })).toHaveAttribute(
            'inputmode',
            'numeric',
        );
        expect(screen.getByText('₽')).toBeVisible();
    });
});

describe('Список недостающего и кнопка', () => {
    it('пустая форма: список из макета, «Опубликовать» неактивна', () => {
        renderSell();

        expect(missing()).toHaveTextContent(
            'Чтобы опубликовать, добавьте: модель, ещё 3 фото, фото серийного номера, состояние, цену.',
        );
        expect(publish()).toBeDisabled();
    });

    it('при 2 фото над кнопкой «добавьте: ещё 1 фото»', () => {
        renderSell({ photos: [photo(1, { is_serial: true, urls: null }), photo(2)] });
        fillRequired();

        expect(missing()).toHaveTextContent('Чтобы опубликовать, добавьте: ещё 1 фото.');
        expect(publish()).toBeDisabled();
    });

    it('список стоит над кнопкой и сообщается скринридеру', () => {
        renderSell();

        const list = missing();
        expect(list).not.toBeNull();
        expect(list).toHaveAttribute('role', 'status');
        expect(list?.compareDocumentPosition(publish())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('всё заполнено: списка нет, кнопка активна', () => {
        renderSell({ photos: THREE });
        fillRequired();

        expect(missing()).toBeNull();
        expect(publish()).toBeEnabled();
    });

    it('без способа передачи кнопка неактивна, в списке «способ передачи»', () => {
        renderSell({ photos: THREE });
        fillRequired();

        fireEvent.click(screen.getByRole('button', { name: 'Встреча в г. Москва' }));
        fireEvent.click(screen.getByRole('button', { name: 'Доставка в защитной упаковке' }));

        expect(missing()).toHaveTextContent('Чтобы опубликовать, добавьте: способ передачи.');
        expect(publish()).toBeDisabled();
    });
});

describe('Превью ListingCard', () => {
    it('до ввода: «Бренд и модель» и «Укажите цену», без «0 ₽» (BR-11)', () => {
        renderSell();
        const preview = screen.getByRole('complementary');

        expect(within(preview).getByText('Так лот увидят покупатели')).toBeVisible();
        expect(within(preview).getByText('Бренд и модель')).toBeVisible();
        expect(within(preview).getByText('Укажите цену')).toBeVisible();
        expect(within(preview).queryByText(/0\s₽/)).toBeNull();
        expect(within(preview).getByText('Москва')).toBeVisible();
        expect(within(preview).getByText('только что')).toBeVisible();
    });

    it('название, цена и город обновляются на лету', () => {
        renderSell();
        fillRequired();
        const preview = screen.getByRole('complementary');

        expect(within(preview).getByText('Fender Stratocaster')).toBeVisible();
        expect(within(preview).getByText(new RegExp(`^184\\s500\\s₽$`))).toBeVisible();
    });

    it('без доставки в карточке нет «Бесплатной доставки»', () => {
        renderSell();
        const preview = screen.getByRole('complementary');
        expect(within(preview).getByText('Бесплатная доставка')).toBeVisible();

        fireEvent.click(screen.getByRole('button', { name: 'Доставка в защитной упаковке' }));

        expect(within(preview).queryByText('Бесплатная доставка')).toBeNull();
    });

    it('в превью — первое обычное фото; фото серийного номера не показывается', () => {
        renderSell({ photos: THREE });
        const preview = screen.getByRole('complementary');

        const image = within(preview).getByAltText('Бренд и модель');
        expect(image).toHaveAttribute('src', '/media/photos/2/square.webp');
    });
});

describe('BR-11: цена — сумма, «Договорная» или «Бесплатно»', () => {
    const chip = (name: string) => screen.getByRole('button', { name });

    it('два режима рядом с суммой; по умолчанию сумма', () => {
        renderSell();

        expect(chip('Договорная')).toHaveAttribute('aria-pressed', 'false');
        expect(chip('Бесплатно')).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('textbox', { name: 'Цена' })).toBeEnabled();
    });

    it('«Договорная»: превью без «0 ₽», сумма и «Готов к торгу» недоступны, цену не просят', () => {
        renderSell({ photos: THREE });
        fillRequired();
        fireEvent.click(chip('Договорная'));
        const preview = screen.getByRole('complementary');

        expect(within(preview).getByText('Договорная')).toBeVisible();
        expect(within(preview).queryByText(/0\s₽/)).toBeNull();
        expect(screen.getByRole('textbox', { name: 'Цена' })).toBeDisabled();
        expect(chip('Готов к торгу')).toBeDisabled();
        expect(chip('Готов к торгу')).toHaveAttribute('aria-pressed', 'false');
        expect(missing()).toBeNull();
        expect(publish()).toBeEnabled();
    });

    it('«Бесплатно»: превью «Бесплатно», отправка с price_mode free и без суммы', () => {
        renderSell({ photos: THREE });
        fillRequired();
        fireEvent.click(chip('Бесплатно'));

        expect(within(screen.getByRole('complementary')).getByText('Бесплатно')).toBeVisible();
        expect(within(screen.getByRole('complementary')).queryByText(/0\s₽/)).toBeNull();

        fireEvent.click(publish());
        expect(post).toHaveBeenCalledWith(
            '/sell',
            expect.objectContaining({ price_mode: 'free', price: null, negotiable: false }),
            expect.anything(),
        );
    });

    it('«Договорная» отправляется как price_mode negotiable, price null', () => {
        renderSell({ photos: THREE });
        fillRequired();
        fireEvent.click(chip('Договорная'));

        fireEvent.click(publish());
        expect(post).toHaveBeenCalledWith(
            '/sell',
            expect.objectContaining({ price_mode: 'negotiable', price: null, negotiable: false }),
            expect.anything(),
        );
    });

    it('повторное нажатие возвращает сумму; введённая сумма и «Готов к торгу» на месте', () => {
        renderSell({ photos: THREE });
        fillRequired();
        fireEvent.click(chip('Договорная'));
        fireEvent.click(chip('Договорная'));

        expect(screen.getByRole('textbox', { name: 'Цена' })).toBeEnabled();
        expect(screen.getByRole('textbox', { name: 'Цена' })).toHaveValue('184\u00a0500');
        expect(chip('Готов к торгу')).toBeEnabled();
        expect(chip('Готов к торгу')).toHaveAttribute('aria-pressed', 'true');
    });

    it('режимы взаимоисключающие', () => {
        renderSell();
        fireEvent.click(chip('Договорная'));
        fireEvent.click(chip('Бесплатно'));

        expect(chip('Договорная')).toHaveAttribute('aria-pressed', 'false');
        expect(chip('Бесплатно')).toHaveAttribute('aria-pressed', 'true');
    });

    it('без суммы в режиме «сумма» кнопка неактивна: в списке «цену»', () => {
        renderSell({ photos: THREE });
        fireEvent.change(modelField(), { target: { value: 'Fender Stratocaster' } });
        fireEvent.click(screen.getByRole('radio', { name: 'Отличное' }));

        expect(missing()).toHaveTextContent('Чтобы опубликовать, добавьте: цену.');
        expect(publish()).toBeDisabled();
    });
});

describe('Блоки за флагами (в MVP выключены)', () => {
    it('«Проверка мастером» и справочник цен не выводятся', () => {
        renderSell();

        expect(screen.queryByText('Проверка мастером')).toBeNull();
        expect(screen.queryByText(/по \d+ продаж/)).toBeNull();
    });

    it('флаг masters включает блок «Проверка мастером»', () => {
        shared = { ...shared, flags: { masters: true } };
        renderSell();

        expect(screen.getByText('Проверка мастером')).toBeVisible();
        expect(
            screen.getByText(
                'Лоты с отчётом мастера продаются быстрее. Закажете после публикации.',
            ),
        ).toBeVisible();
    });
});

describe('Модель из справочника', () => {
    it('выбор модели из пункта меняет вид на корневой вид инструмента', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                ok: true,
                status: 200,
                json: async () => ({
                    data: [
                        {
                            id: 77,
                            brand: 'Boss',
                            name: 'FZ-2',
                            year_from: null,
                            year_to: null,
                            category_id: 211,
                        },
                    ],
                }),
            })),
        );
        renderSell({ photos: THREE });

        fireEvent.change(modelField(), { target: { value: 'Boss FZ' } });
        fireEvent.mouseDown(await screen.findByRole('option', { name: 'Boss FZ-2' }));

        expect(screen.getByRole('radio', { name: 'Педали и усилители' })).toHaveAttribute(
            'aria-checked',
            'true',
        );
        fireEvent.click(screen.getByRole('radio', { name: 'Отличное' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Цена' }), {
            target: { value: '9000' },
        });
        fireEvent.click(publish());

        expect(post).toHaveBeenCalledWith(
            '/sell',
            expect.objectContaining({ model_id: 77, category_id: 2, title: 'Boss FZ-2' }),
            expect.anything(),
        );
    });
});

describe('Отправка', () => {
    it('отправляет данные формы на /sell: цена целым числом, модель без выбора — model_id null', () => {
        renderSell({ photos: THREE });
        fireEvent.change(screen.getByRole('textbox', { name: 'Год выпуска' }), {
            target: { value: '2009' },
        });
        fireEvent.change(screen.getByRole('textbox', { name: 'Серийный номер' }), {
            target: { value: 'V091187' },
        });
        fireEvent.change(screen.getByRole('textbox', { name: 'Описание' }), {
            target: { value: 'Родной кейс.' },
        });
        fillRequired();

        fireEvent.click(publish());

        expect(post).toHaveBeenCalledTimes(1);
        expect(post).toHaveBeenCalledWith(
            '/sell',
            {
                listing_id: '9f1c-listing',
                category_id: 1,
                title: 'Fender Stratocaster',
                model_id: null,
                year: 2009,
                serial: 'V091187',
                condition: 'excellent',
                description: 'Родной кейс.',
                price_mode: 'amount',
                price: 184_500,
                negotiable: true,
                meet: true,
                ship: true,
            },
            expect.objectContaining({ preserveScroll: true, preserveState: true }),
        );
    });

    it('неполную форму не отправляет', () => {
        renderSell();

        const form = publish().closest('form');
        if (form === null) throw new Error('Нет формы');
        fireEvent.submit(form);

        expect(post).not.toHaveBeenCalled();
    });

    it('пустые год и серийный номер уходят как null', () => {
        renderSell({ photos: THREE });
        fillRequired();

        fireEvent.click(publish());

        expect(post).toHaveBeenCalledWith(
            '/sell',
            expect.objectContaining({ year: null, serial: null, description: null }),
            expect.anything(),
        );
    });

    it('после сохранения: сообщение о черновике', () => {
        renderSell({ saved: true });

        expect(screen.getByText('Данные сохранены в черновике')).toBeVisible();
    });
});

describe('Ошибки сервера', () => {
    it('ошибка поля показывается у поля', () => {
        shared = { ...shared, errors: { price: 'Укажите цену от 1 ₽.' } };
        renderSell();

        expect(screen.getByRole('textbox', { name: 'Цена' })).toHaveAccessibleDescription(
            /Укажите цену от 1 ₽\./,
        );
    });

    it('ошибки без поля (состояние, фото, передача) — в одном сообщении над кнопкой', () => {
        shared = {
            ...shared,
            errors: {
                condition: 'Выберите состояние.',
                photos: 'ещё 1 фото',
                meet: 'Выберите способ передачи.',
            },
        };
        renderSell();

        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('Выберите состояние.');
        expect(alert).toHaveTextContent('ещё 1 фото');
        expect(alert).toHaveTextContent('Выберите способ передачи.');
    });

    it('без ошибок сообщения нет', () => {
        renderSell();

        expect(screen.queryByRole('alert')).toBeNull();
    });
});

describe('Каркас', () => {
    it('страница объявляет постоянную раскладку PublicLayout', () => {
        expect(SellCreate.layout).toBeTypeOf('function');
    });
});
