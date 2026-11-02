import type { ReactNode } from 'react';

import {
    AccessoryCard,
    AccessoryRail,
    Alert,
    Badge,
    Button,
    CatalogSwitch,
    Checkbox,
    ConditionBadge,
    ConditionMeter,
    FavoriteButton,
    Field,
    FilterChip,
    FitmentBadge,
    Footer,
    Header,
    Icon,
    IconButton,
    ListingCard,
    MasterCard,
    ModelSummary,
    OfferList,
    PassportCard,
    PriceGuide,
    PriceTag,
    Radio,
    Rating,
    RepairOrderCard,
    SearchBar,
    SellerCard,
    Select,
    ServicePicker,
    Textarea,
    Timeline,
    TrustStrip,
    Wordmark,
    type IconName,
} from '@ds';

export interface ShowcaseVariant {
    label: string;
    node: ReactNode;
}

export interface ShowcaseSection {
    /** Имя экспорта из `@ds`. */
    component: string;
    /** Группа, как в `*.card.html`. */
    group: string;
    variants: ShowcaseVariant[];
}

const ACTIONS = 'Действия';
const CORE = 'Навигация и основа';
const DISPLAY = 'Отображение';
const COMMERCE = 'Торговля';
const FORMS = 'Формы';
const SERVICE = 'Сервис';

const ICON_NAMES: IconName[] = [
    'heart',
    'search',
    'shopping-bag',
    'message-circle',
    'user',
    'shield-check',
    'wrench',
    'package',
    'truck',
    'map-pin',
    'star',
    'camera',
    'tag',
    'badge-check',
    'guitar',
    'piano',
    'drum',
    'mic',
    'headphones',
    'speaker',
    'cable',
    'sliders-horizontal',
    'clock',
    'check',
    'x',
    'chevron-right',
    'chevron-down',
    'plus',
    'info',
    'triangle-alert',
    'circle-alert',
    'circle-check',
    'history',
    'scan-barcode',
    'hammer',
    'handshake',
    'bell',
    'arrow-down-right',
    'locate-fixed',
    'store',
    'layout-grid',
    'calendar-clock',
    'boxes',
    'menu',
    'minus',
];

const BUTTON_STATES = [
    ['по умолчанию', {}],
    ['наведение', { demo: 'hover' }],
    ['фокус', { demo: 'focus' }],
    ['нажатие', { demo: 'active' }],
    ['неактивна', { disabled: true }],
    ['загрузка', { loading: true }],
] as const;

const cols = (min: number): { gridTemplateColumns: string } => ({
    gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${min}px), 1fr))`,
});

export const SHOWCASE: readonly ShowcaseSection[] = [
    {
        component: 'Button',
        group: ACTIONS,
        variants: [
            {
                label: 'primary и outline',
                node: (
                    <div className="ym-row">
                        <Button variant="primary" size="l" icon="message-circle">
                            Написать продавцу
                        </Button>
                        <Button variant="outline" icon="handshake">
                            Предложить цену
                        </Button>
                    </div>
                ),
            },
            {
                label: 'inverse и primary для новых товаров',
                node: (
                    <div className="ym-row">
                        <Button variant="primary" size="l">
                            Купить
                        </Button>
                        <Button variant="inverse">В корзину</Button>
                    </div>
                ),
            },
            {
                label: 'service, muted, ghost, danger, размер xs',
                node: (
                    <div className="ym-row">
                        <Button variant="service" size="s" icon="wrench">
                            Записаться к мастеру
                        </Button>
                        <Button variant="muted" size="s">
                            Сохранить черновик
                        </Button>
                        <Button variant="ghost" size="s" iconRight="chevron-right">
                            Все лоты
                        </Button>
                        <Button variant="danger" size="s">
                            Снять с продажи
                        </Button>
                        <Button variant="primary" size="xs" icon="plus">
                            Добавить фото
                        </Button>
                    </div>
                ),
            },
            {
                label: 'состояния',
                node: (
                    <div className="ym-row">
                        {BUTTON_STATES.map(([state, props]) => (
                            <div key={state} className="ym-stack">
                                <span className="type-caption">{state}</span>
                                <Button variant="primary" icon="shield-check" {...props}>
                                    Оплатить
                                </Button>
                            </div>
                        ))}
                    </div>
                ),
            },
        ],
    },
    {
        component: 'FavoriteButton',
        group: ACTIONS,
        variants: [
            {
                label: 'выключена, включена, со счётчиком',
                node: (
                    <div className="ym-row">
                        <FavoriteButton />
                        <FavoriteButton active />
                        <FavoriteButton count={80} />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'IconButton',
        group: ACTIONS,
        variants: [
            {
                label: 'иконки шапки',
                node: (
                    <div className="ym-row">
                        <IconButton icon="heart" label="Избранное" />
                        <IconButton icon="message-circle" label="Сообщения" count={3} />
                        <IconButton icon="shopping-bag" label="Корзина" count={1} />
                        <IconButton icon="user" label="Войти" />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'Footer',
        group: CORE,
        variants: [
            { label: 'full', node: <Footer /> },
            { label: 'compact', node: <Footer variant="compact" /> },
        ],
    },
    {
        component: 'Header',
        group: CORE,
        variants: [
            {
                label: 'в проекте не используется: подпись кнопки не проходит словарь (AGENTS.md §5), вместо него SiteHeader',
                node: <Header active="flea" cart={1} messages={3} />,
            },
        ],
    },
    {
        component: 'Icon',
        group: CORE,
        variants: [
            {
                label: `набор иконок Lucide (${ICON_NAMES.length})`,
                node: (
                    <div className="ym-row">
                        {ICON_NAMES.map((name) => (
                            <span
                                key={name}
                                title={name}
                                style={{
                                    display: 'inline-flex',
                                    width: 'var(--space-10)',
                                    height: 'var(--space-10)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'var(--surface-recessed)',
                                }}
                            >
                                <Icon name={name} size={20} />
                            </span>
                        ))}
                    </div>
                ),
            },
        ],
    },
    {
        component: 'Wordmark',
        group: CORE,
        variants: [
            {
                label: '40 и 24 px',
                node: (
                    <div className="ym-row">
                        <Wordmark size={40} />
                        <Wordmark size={24} />
                    </div>
                ),
            },
            {
                label: 'mono на заливках',
                node: (
                    <div className="ym-row">
                        <span
                            style={{
                                background: 'var(--surface-inverse)',
                                color: 'var(--ink-inverse)',
                                padding: 'var(--space-3) var(--space-4)',
                                borderRadius: 'var(--radius-md)',
                            }}
                        >
                            <Wordmark size={24} mono />
                        </span>
                        <span
                            style={{
                                background: 'var(--accent)',
                                color: 'var(--on-accent)',
                                padding: 'var(--space-3) var(--space-4)',
                                borderRadius: 'var(--radius-md)',
                            }}
                        >
                            <Wordmark size={24} mono />
                        </span>
                    </div>
                ),
            },
        ],
    },
    {
        component: 'Alert',
        group: DISPLAY,
        variants: [
            {
                label: 'success, warning, service, danger',
                node: (
                    <div className="ym-stack">
                        <Alert tone="success" title="Безопасная сделка">
                            Продавец получит 184 500 ₽ после того, как вы подтвердите получение.
                        </Alert>
                        <Alert
                            tone="warning"
                            title="Продавец не указал доставку в ваш город"
                            action="Спросить"
                        >
                            Напишите продавцу или выберите доставку в защитной упаковке.
                        </Alert>
                        <Alert tone="service" title="Проверка перед покупкой — 1 900 ₽">
                            Мастер посмотрит инструмент до отправки и сверит серийный номер.
                        </Alert>
                        <Alert tone="danger" title="Оплата не прошла">
                            Банк отклонил платёж. Попробуйте СБП или другую карту.
                        </Alert>
                    </div>
                ),
            },
            {
                label: 'info',
                node: (
                    <Alert tone="info" title="Новое сообщение">
                        Продавец ответил на ваш вопрос о грифе.
                    </Alert>
                ),
            },
        ],
    },
    {
        component: 'Badge',
        group: DISPLAY,
        variants: [
            {
                label: 'тоны',
                node: (
                    <div className="ym-row">
                        <Badge>Самовывоз</Badge>
                        <Badge tone="accent" icon="shield-check">
                            Безопасная сделка
                        </Badge>
                        <Badge tone="service" icon="badge-check">
                            Проверено мастером
                        </Badge>
                        <Badge tone="parts" icon="cable">
                            Оригинальная деталь
                        </Badge>
                        <Badge tone="guide">Цены продаж</Badge>
                        <Badge tone="info">Новое сообщение</Badge>
                        <Badge tone="warning">Ждёт ответа</Badge>
                        <Badge tone="danger">Спор открыт</Badge>
                        <Badge tone="solid">Редкая находка</Badge>
                    </div>
                ),
            },
        ],
    },
    {
        component: 'ConditionBadge',
        group: DISPLAY,
        variants: [
            {
                label: '8 ступеней состояния',
                node: (
                    <div className="ym-row">
                        {(
                            [
                                'new',
                                'mint',
                                'excellent',
                                'very-good',
                                'good',
                                'fair',
                                'poor',
                                'parts',
                            ] as const
                        ).map((condition) => (
                            <ConditionBadge key={condition} condition={condition} />
                        ))}
                    </div>
                ),
            },
        ],
    },
    {
        component: 'FitmentBadge',
        group: DISPLAY,
        variants: [
            {
                label: 'подходит, проверить, не подходит',
                node: (
                    <div className="ym-stack">
                        <FitmentBadge target="вашему Fender Stratocaster ’79" />
                        <FitmentBadge status="check" target="Gibson Les Paul Studio 2014" />
                        <FitmentBadge status="no" target="Ibanez RG550" />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'PriceTag',
        group: DISPLAY,
        variants: [
            {
                label: 'pdp, со скидкой и доставкой, просто цена',
                node: (
                    <div className="ym-row">
                        <PriceTag price={184500} shipping={0} size="pdp" />
                        <PriceTag price={149000} oldPrice={162000} shipping={1200} />
                        <PriceTag price={14500} />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'Rating',
        group: DISPLAY,
        variants: [
            {
                label: 'с отзывами и без',
                node: (
                    <div className="ym-row">
                        <Rating value={4.9} count={212} />
                        <Rating value={5} />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'AccessoryCard',
        group: COMMERCE,
        variants: [
            {
                label: 'подходит, в корзине, добавляется, ошибка',
                node: (
                    <div className="ym-cols" style={cols(260)}>
                        <AccessoryCard
                            title="Струны Ernie Ball Regular Slinky 10–46"
                            price={790}
                            fit="fits"
                            icon="cable"
                        />
                        <AccessoryCard
                            title="Чехол Fender Performance для Stratocaster"
                            price={8990}
                            fit="fits"
                            icon="package"
                            inCart
                        />
                        <AccessoryCard
                            title="Звукосниматели Seymour Duncan SSL-1, комплект"
                            price={16900}
                            fit="check"
                            icon="cable"
                            adding
                        />
                        <AccessoryCard
                            title="Ремень Levy’s кожаный 2,5″"
                            price={3400}
                            icon="package"
                            error="Не добавилось. Повторите"
                        />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'AccessoryRail',
        group: COMMERCE,
        variants: [
            {
                label: 'аксессуары по группам',
                node: (
                    <AccessoryRail
                        title="Аксессуары к Fender Player II Stratocaster"
                        groups={[
                            {
                                name: 'Струны',
                                items: [
                                    {
                                        title: 'Ernie Ball Regular Slinky 10–46',
                                        price: 790,
                                        fit: 'fits',
                                        icon: 'cable',
                                    },
                                    {
                                        title: 'D’Addario EXL110, 3 комплекта',
                                        price: 2190,
                                        fit: 'fits',
                                        icon: 'cable',
                                    },
                                    {
                                        title: 'Elixir Nanoweb 10–46',
                                        price: 1890,
                                        fit: 'fits',
                                        icon: 'cable',
                                    },
                                ],
                            },
                            {
                                name: 'Чехлы и кейсы',
                                items: [
                                    {
                                        title: 'Чехол Fender Performance',
                                        price: 8990,
                                        fit: 'fits',
                                        icon: 'package',
                                    },
                                    {
                                        title: 'Кейс SKB для Strat/Tele',
                                        price: 21500,
                                        fit: 'fits',
                                        icon: 'package',
                                    },
                                ],
                            },
                            {
                                name: 'Звукосниматели',
                                items: [
                                    {
                                        title: 'Seymour Duncan SSL-1, комплект',
                                        price: 16900,
                                        fit: 'check',
                                        icon: 'cable',
                                    },
                                ],
                            },
                            {
                                name: 'Ремни',
                                items: [
                                    {
                                        title: 'Ремень Levy’s кожаный 2,5″',
                                        price: 3400,
                                        icon: 'package',
                                    },
                                ],
                            },
                        ]}
                    />
                ),
            },
        ],
    },
    {
        component: 'CatalogSwitch',
        group: COMMERCE,
        variants: [
            {
                label: 'по умолчанию и с ссылками',
                node: (
                    <div className="ym-stack">
                        <CatalogSwitch counts={{ catalog: 3412, flea: 18760 }} />
                        <CatalogSwitch
                            value="flea"
                            counts={{ catalog: 3412, flea: 18760 }}
                            hrefs={{ catalog: '#catalog', flea: '#flea' }}
                        />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'ConditionMeter',
        group: COMMERCE,
        variants: [
            {
                label: 'шкала состояния б/у',
                node: (
                    <div className="ym-row">
                        {(
                            [
                                'mint',
                                'excellent',
                                'very-good',
                                'good',
                                'fair',
                                'poor',
                                'parts',
                            ] as const
                        ).map((condition) => (
                            <ConditionMeter key={condition} condition={condition} />
                        ))}
                    </div>
                ),
            },
        ],
    },
    {
        component: 'ListingCard',
        group: COMMERCE,
        variants: [
            {
                label: 'карточки лотов',
                node: (
                    <div className="ym-grid">
                        <ListingCard
                            title="Fender American Vintage ’57 Stratocaster 2009, Sunburst"
                            price={184500}
                            condition="excellent"
                            city="Москва"
                            shipping={0}
                            inspected
                        />
                        <ListingCard
                            title="Gibson Les Paul Studio 2014, Wine Red"
                            price={149000}
                            oldPrice={162000}
                            condition="very-good"
                            city="Санкт-Петербург"
                            shipping={1200}
                            favorite
                        />
                        <ListingCard
                            title="Boss DS-1 Distortion, Made in Japan 1986"
                            price={14500}
                            city="Екатеринбург"
                            condition="parts"
                            rare
                            icon="cable"
                        />
                        <ListingCard
                            title="Roland Juno-106, 1984"
                            price={189000}
                            condition="fair"
                            city="Новосибирск"
                            inspected
                            safe={false}
                            icon="piano"
                        />
                        <ListingCard
                            title="Yamaha Pacifica 112V, Sonic Blue"
                            price={32990}
                            condition="new"
                            partner
                            rating={4.8}
                            reviews={1240}
                            delivery="Завтра"
                        />
                        <ListingCard
                            title="Boss RC-30 Loop Station"
                            price={12000}
                            condition="very-good"
                            city="Москва"
                            distance="1,8 км"
                            posted="2 ч назад"
                            icon="cable"
                        />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'ModelSummary',
        group: COMMERCE,
        variants: [
            {
                label: 'модель с новыми и б/у предложениями',
                node: (
                    <div style={{ maxWidth: '760px' }}>
                        <ModelSummary
                            category="Гитары · Электрогитары · Fender"
                            name="Fender Player II Stratocaster"
                            specs={['Ольха', 'Кленовый гриф', '3 × сингл', '22 лада']}
                            newFrom={109990}
                            newCount={4}
                            warranty
                            usedFrom={78000}
                            usedCount={17}
                            guide={{ low: 74000, high: 92000 }}
                        />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'OfferList',
        group: COMMERCE,
        variants: [
            {
                label: 'предложения продавцов',
                node: (
                    <div style={{ maxWidth: '760px' }}>
                        <OfferList
                            offers={[
                                {
                                    seller: 'Музыкальный салон «Квинта»',
                                    partner: true,
                                    condition: 'new',
                                    price: 109990,
                                    shipping: 0,
                                    eta: 'завтра',
                                    city: 'Москва',
                                    rating: 4.9,
                                    reviews: 1840,
                                },
                                {
                                    seller: 'Гитарный угол',
                                    partner: true,
                                    condition: 'new',
                                    price: 112500,
                                    shipping: 0,
                                    eta: '2–3 дня',
                                    city: 'Санкт-Петербург',
                                    rating: 4.8,
                                    reviews: 612,
                                },
                                {
                                    seller: 'Павел К.',
                                    condition: 'excellent',
                                    price: 84000,
                                    shipping: 900,
                                    city: 'Тверь',
                                    rating: 5,
                                    reviews: 12,
                                    inspected: true,
                                },
                                {
                                    seller: 'Ирина М.',
                                    condition: 'good',
                                    price: 78000,
                                    city: 'Москва',
                                    rating: 4.7,
                                    reviews: 5,
                                },
                            ]}
                        />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'PriceGuide',
        group: COMMERCE,
        variants: [
            {
                label: 'цена в диапазоне и ниже диапазона',
                node: (
                    <div className="ym-cols">
                        <PriceGuide
                            low={168000}
                            high={196000}
                            price={184500}
                            basis="по 41 продаже за 12 месяцев"
                        />
                        <PriceGuide
                            low={120000}
                            high={150000}
                            price={94000}
                            basis="по 17 продажам за 12 месяцев"
                        />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'SellerCard',
        group: COMMERCE,
        variants: [
            {
                label: 'магазин с метками',
                node: (
                    <div className="ym-cols">
                        <SellerCard
                            name="Гитарный угол"
                            rating={4.9}
                            reviews={432}
                            city="Москва"
                            since="2025"
                            badges={[
                                { label: 'Быстро отправляет', tone: 'accent', icon: 'truck' },
                                { label: 'Магазин', tone: 'parts' },
                            ]}
                        />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'TrustStrip',
        group: COMMERCE,
        variants: [
            {
                label: 'тексты передаются пропсом items (в умолчаниях ДС есть слова вне словаря)',
                node: (
                    <TrustStrip
                        items={[
                            {
                                icon: 'shield-check',
                                tone: 'accent',
                                title: 'Безопасная сделка',
                                text: 'Деньги у площадки, пока вы не проверите инструмент.',
                            },
                            {
                                icon: 'badge-check',
                                tone: 'service',
                                title: 'Проверено мастером',
                                text: 'Мастер смотрит инструмент до отправки.',
                            },
                            {
                                icon: 'history',
                                tone: 'parts',
                                title: 'Паспорт инструмента',
                                text: 'История по серийному номеру.',
                            },
                        ]}
                    />
                ),
            },
        ],
    },
    {
        component: 'Checkbox',
        group: FORMS,
        variants: [
            {
                label: 'по умолчанию, наведение, фокус',
                node: (
                    <div className="ym-stack">
                        <Checkbox id="ds-c1" label="Только с безопасной сделкой" />
                        <Checkbox id="ds-c2" label="Проверено мастером" demo="hover" />
                        <Checkbox id="ds-c3" label="Доставка завтра" demo="focus" />
                    </div>
                ),
            },
            {
                label: 'отмечен, частично, с подсказкой',
                node: (
                    <div className="ym-stack">
                        <Checkbox id="ds-c4" label="Оригинал" defaultChecked />
                        <Checkbox id="ds-c5" label="Все бренды" indeterminate />
                        <Checkbox
                            id="ds-c6"
                            label="Показывать б/у"
                            hint="Лоты частных продавцов из Барахолки"
                            defaultChecked
                        />
                    </div>
                ),
            },
            {
                label: 'неактивен и ошибка',
                node: (
                    <div className="ym-stack">
                        <Checkbox id="ds-c7" label="Рядом со мной" disabled />
                        <Checkbox id="ds-c8" label="Новое" disabled defaultChecked />
                        <Checkbox
                            id="ds-c9"
                            label="Принимаю правила площадки"
                            error="Без согласия опубликовать нельзя"
                        />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'Field',
        group: FORMS,
        variants: [
            {
                label: 'по умолчанию, фокус, загрузка',
                node: (
                    <div className="ym-cols" style={cols(240)}>
                        <Field
                            id="ds-f1"
                            label="Цена"
                            suffix="₽"
                            defaultValue="184 500"
                            hint="Цены продаж: 168 000 – 196 000 ₽"
                        />
                        <Field
                            id="ds-f2"
                            label="Серийный номер"
                            placeholder="V091187"
                            hint="Сверим с паспортом инструмента"
                            demo="focus"
                        />
                        <Field
                            id="ds-f3"
                            label="Серийный номер"
                            defaultValue="V091187"
                            loading
                            hint="Ищем в паспортах…"
                        />
                    </div>
                ),
            },
            {
                label: 'успех, ошибка, неактивно',
                node: (
                    <div className="ym-cols" style={cols(240)}>
                        <Field
                            id="ds-f4"
                            label="Серийный номер"
                            defaultValue="V091187"
                            success
                            hint="Паспорт найден: Fender, 2009"
                        />
                        <Field
                            id="ds-f5"
                            label="Минимальная цена для согласования"
                            suffix="₽"
                            defaultValue="120 000"
                            error="Ниже диапазона цен продаж больше чем на 25%"
                        />
                        <Field
                            id="ds-f6"
                            label="Город"
                            defaultValue="Москва"
                            disabled
                            hint="Город берётся из профиля"
                        />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'FilterChip',
        group: FORMS,
        variants: [
            {
                label: 'выбран, со счётчиком, с иконкой, неактивен',
                node: (
                    <div className="ym-row">
                        <FilterChip selected removable>
                            Б/у
                        </FilterChip>
                        <FilterChip count={1284}>Новое</FilterChip>
                        <FilterChip icon="shield-check">Только безопасная сделка</FilterChip>
                        <FilterChip icon="badge-check">Проверено мастером</FilterChip>
                        <FilterChip icon="map-pin" count={312}>
                            Москва
                        </FilterChip>
                        <FilterChip disabled count={0}>
                            Самовывоз
                        </FilterChip>
                    </div>
                ),
            },
            {
                label: 'radio — одиночный выбор',
                node: (
                    <div className="ym-row">
                        <FilterChip radio selected>
                            Новые
                        </FilterChip>
                        <FilterChip radio>Б/у</FilterChip>
                    </div>
                ),
            },
        ],
    },
    {
        component: 'Radio',
        group: FORMS,
        variants: [
            {
                label: 'столбцом, с подсказками',
                node: (
                    <Radio
                        name="ds-r1"
                        label="Доставка"
                        defaultValue="courier"
                        options={[
                            { value: 'courier', label: 'Курьер', hint: 'Завтра, бесплатно' },
                            { value: 'pickup', label: 'Пункт выдачи', hint: '600 м от вас' },
                            {
                                value: 'pack',
                                label: 'Доставка в защитной упаковке',
                                hint: 'Для инструментов, со страховкой',
                            },
                        ]}
                    />
                ),
            },
            {
                label: 'в строку, наведение и фокус',
                node: (
                    <div className="ym-stack">
                        <Radio
                            name="ds-r2"
                            label="Продавец"
                            options={['Частное лицо', 'Магазин']}
                            demo="hover"
                            inline
                        />
                        <Radio
                            name="ds-r3"
                            options={['Частное лицо', 'Магазин']}
                            demo="focus"
                            inline
                        />
                        <Radio
                            name="ds-r4"
                            label="Оплата"
                            inline
                            defaultValue="СБП"
                            options={['СБП', 'Картой онлайн']}
                        />
                    </div>
                ),
            },
            {
                label: 'вариант неактивен, группа неактивна, ошибка',
                node: (
                    <div className="ym-stack">
                        <Radio
                            name="ds-r5"
                            label="Получение"
                            defaultValue="Самовывоз"
                            options={[
                                'Самовывоз',
                                { value: 'meet', label: 'Встреча в метро', disabled: true },
                            ]}
                        />
                        <Radio
                            name="ds-r6"
                            label="Состояние"
                            disabled
                            defaultValue="Отличное"
                            options={['Отличное', 'Хорошее']}
                        />
                        <Radio
                            name="ds-r7"
                            label="Тип объявления"
                            error="Выберите тип объявления"
                            options={['Продаю', 'Ищу']}
                        />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'SearchBar',
        group: FORMS,
        variants: [
            {
                label: 'по всему сайту и в разделе',
                node: (
                    <div className="ym-stack">
                        <SearchBar id="ds-s1" />
                        <SearchBar
                            id="ds-s2"
                            scope="Мастера"
                            placeholder="Перешлифовка ладов, ремонт лампового усилителя"
                        />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'Select',
        group: FORMS,
        variants: [
            {
                label: 'плейсхолдер, наведение, фокус',
                node: (
                    <div className="ym-cols" style={cols(240)}>
                        <Select
                            id="ds-sel1"
                            label="Город"
                            placeholder="Выберите город"
                            options={['Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург']}
                        />
                        <Select
                            id="ds-sel2"
                            label="Страна"
                            defaultValue="США"
                            options={['США', 'Мексика', 'Япония', 'Индонезия']}
                            demo="hover"
                        />
                        <Select
                            id="ds-sel3"
                            label="Сортировка"
                            defaultValue="Популярные"
                            options={['Популярные', 'Дешевле', 'Дороже', 'С высоким рейтингом']}
                            demo="focus"
                        />
                    </div>
                ),
            },
            {
                label: 'выбрано, неактивно, ошибка',
                node: (
                    <div className="ym-cols" style={cols(240)}>
                        <Select
                            id="ds-sel4"
                            label="Год выпуска"
                            defaultValue="2009"
                            hint="Смотрите по серийному номеру"
                            options={['2010', '2009', '2008']}
                        />
                        <Select
                            id="ds-sel5"
                            label="Модель"
                            placeholder="Сначала выберите бренд"
                            disabled
                            options={[]}
                        />
                        <Select
                            id="ds-sel6"
                            label="Категория"
                            placeholder="Не выбрано"
                            error="Выберите категорию"
                            options={['Электрогитары', 'Бас-гитары']}
                        />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'Textarea',
        group: FORMS,
        variants: [
            {
                label: 'плейсхолдер, наведение, фокус',
                node: (
                    <div className="ym-stack">
                        <Textarea
                            id="ds-t1"
                            label="Описание"
                            placeholder="Что с грифом, ладами, электрикой; что в комплекте"
                            rows={3}
                        />
                        <Textarea
                            id="ds-t2"
                            label="Сообщение продавцу"
                            rows={3}
                            defaultValue="Здравствуйте. Инструмент ещё продаётся?"
                            demo="hover"
                        />
                        <Textarea
                            id="ds-t3"
                            label="Что случилось с инструментом"
                            rows={3}
                            demo="focus"
                            defaultValue="Фонит при касании струн"
                        />
                    </div>
                ),
            },
            {
                label: 'счётчик символов, неактивно, ошибка',
                node: (
                    <div className="ym-stack">
                        <Textarea
                            id="ds-t4"
                            label="Описание"
                            rows={3}
                            maxLength={300}
                            hint="Без телефонов и ссылок"
                            defaultValue="Гриф шлифовали один раз, лады в отличном состоянии. Оригинальные звукосниматели, родной кейс."
                        />
                        <Textarea
                            id="ds-t5"
                            label="Ответ мастера"
                            rows={3}
                            disabled
                            defaultValue="Мастер ответит после осмотра"
                        />
                        <Textarea
                            id="ds-t6"
                            label="Описание"
                            rows={3}
                            error="Добавьте хотя бы пару предложений"
                        />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'MasterCard',
        group: SERVICE,
        variants: [
            {
                label: 'мастер и мастерская',
                node: (
                    <div className="ym-cols">
                        <MasterCard
                            name="Алексей Воронцов"
                            workshop="Мастерская «Лад и строй»"
                            rating={4.9}
                            reviews={212}
                            specialties={['Перешлифовка ладов', 'Настройка', 'Электрика']}
                            priceFrom={2500}
                            eta="3–5 дней"
                            distance="2,4 км"
                            verified
                        />
                        <MasterCard
                            name="Ирина Белова"
                            workshop="Ламповый сервис"
                            rating={4.8}
                            reviews={97}
                            specialties={['Ламповые усилители', 'Педали']}
                            priceFrom={3000}
                            eta="до 10 дней"
                            city="Казань"
                        />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'PassportCard',
        group: SERVICE,
        variants: [
            {
                label: 'паспорт инструмента с историей',
                node: (
                    <div style={{ maxWidth: '640px' }}>
                        <PassportCard
                            instrument="Fender American Vintage ’57 Stratocaster"
                            serial="V091187"
                            year="2009"
                            owners={3}
                            verified
                            events={[
                                {
                                    date: '14.09.2026',
                                    kind: 'inspection',
                                    text: 'Проверка перед покупкой: отчёт из 14 пунктов, без замечаний',
                                    by: 'А. Воронцов · «Лад и строй»',
                                },
                                {
                                    date: '02.03.2023',
                                    kind: 'sale',
                                    text: 'Сделка на ЯМузыканте через безопасную сделку',
                                    by: 'Москва → Тверь',
                                },
                                {
                                    date: '11.06.2018',
                                    kind: 'repair',
                                    text: 'Перешлифовка ладов, замена порожка (кость)',
                                    by: 'Мастерская, чек приложен',
                                },
                                {
                                    date: '20.11.2009',
                                    kind: 'setup',
                                    text: 'Первая продажа, заводская настройка',
                                    by: 'Официальный дилер',
                                },
                            ]}
                        />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'RepairOrderCard',
        group: SERVICE,
        variants: [
            {
                label: 'заказ в ремонте',
                node: (
                    <div style={{ maxWidth: '760px' }}>
                        <RepairOrderCard
                            number="ЗАКАЗ ЯМ-26-00317"
                            instrument="Gibson Les Paul Studio 2014"
                            work="Перешлифовка ладов и настройка"
                            status="Ремонт"
                            amount={7800}
                            master="А. Воронцов"
                            action="Написать мастеру"
                            steps={[
                                { label: 'Принят', meta: '2 окт', state: 'done' },
                                { label: 'Диагностика', meta: '3 окт', state: 'done' },
                                { label: 'Смета', meta: '7 800 ₽', state: 'done' },
                                { label: 'Ремонт', meta: 'до 8 окт', state: 'current' },
                                { label: 'Выдача' },
                            ]}
                        />
                    </div>
                ),
            },
        ],
    },
    {
        component: 'ServicePicker',
        group: SERVICE,
        variants: [
            {
                label: 'геолокация разрешена, мастера рядом',
                node: (
                    <ServicePicker
                        id="ds-sp1"
                        category="Электрогитары"
                        services={[
                            'Настройка',
                            'Перешлифовка ладов',
                            'Электрика',
                            'Замена порожка',
                        ]}
                        geo="granted"
                        place="Москва, Таганская"
                        masters={[
                            {
                                name: 'Алексей Воронцов',
                                rating: 4.9,
                                reviews: 212,
                                distance: '2,4 км',
                                priceFrom: 2500,
                                slot: 'завтра, 11:00',
                            },
                            {
                                name: 'Мастерская «Лад и строй»',
                                rating: 4.8,
                                reviews: 530,
                                distance: '3,1 км',
                                priceFrom: 3000,
                                slot: 'пт, 15:00',
                            },
                            {
                                name: 'Дмитрий Соколов',
                                rating: 4.7,
                                reviews: 64,
                                distance: '5,8 км',
                                priceFrom: 2000,
                                slot: 'через 3 дня',
                            },
                        ]}
                    />
                ),
            },
            {
                label: 'запрос геолокации, загрузка, отказ',
                node: (
                    <div className="ym-stack">
                        <ServicePicker
                            id="ds-sp2"
                            category="Электрогитары"
                            services={['Настройка', 'Перешлифовка ладов', 'Электрика']}
                            geo="prompt"
                        />
                        <ServicePicker
                            id="ds-sp5"
                            category="Электрогитары"
                            services={['Настройка', 'Электрика']}
                            geo="loading"
                        />
                        <ServicePicker
                            id="ds-sp3"
                            category="Электрогитары"
                            services={['Настройка', 'Перешлифовка ладов']}
                            geo="denied"
                        />
                    </div>
                ),
            },
            {
                label: 'мастеров рядом нет, есть удалённые',
                node: (
                    <ServicePicker
                        id="ds-sp4"
                        category="Духовые"
                        services={['Ремонт клапанов', 'Чистка']}
                        geo="granted"
                        place="Тверь"
                        masters={[]}
                        remote={3}
                    />
                ),
            },
        ],
    },
    {
        component: 'Timeline',
        group: SERVICE,
        variants: [
            {
                label: 'сделка (accent) и ремонт (service)',
                node: (
                    <div className="ym-stack">
                        <Timeline
                            steps={[
                                {
                                    label: 'Оплачено',
                                    meta: 'безопасная сделка · 3 окт',
                                    state: 'done',
                                },
                                {
                                    label: 'Отправлено',
                                    meta: 'доставка в защитной упаковке',
                                    state: 'done',
                                },
                                { label: 'Получено', meta: 'ожидается 7 окт', state: 'current' },
                                { label: 'Проверка', meta: '24 часа' },
                                { label: 'Деньги продавцу' },
                            ]}
                        />
                        <Timeline
                            tone="service"
                            steps={[
                                { label: 'Принят', state: 'done' },
                                { label: 'Диагностика', state: 'done' },
                                { label: 'Смета', state: 'done' },
                                { label: 'Ремонт', meta: 'до 8 окт', state: 'current' },
                                { label: 'Выдача' },
                            ]}
                        />
                    </div>
                ),
            },
            {
                label: 'вертикальная',
                node: (
                    <Timeline
                        orientation="vertical"
                        steps={[
                            { label: 'Оплачено', state: 'done' },
                            { label: 'Отправлено', state: 'current' },
                            { label: 'Получено' },
                        ]}
                    />
                ),
            },
        ],
    },
];
