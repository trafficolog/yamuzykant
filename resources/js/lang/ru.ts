/** Тексты интерфейса на фронте (AGENTS.md §4–5). Проверяются `npm run lint:copy`. */
/** «1 лот, 2 лота, 5 лотов». */
const lots = (count: number): string => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'лот';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'лота';
    return 'лотов';
};

export const ru = {
    brand: 'ЯМузыкант',
    ds: {
        title: 'Витрина дизайн-системы',
        intro: 'Все компоненты из «@ds» со всеми вариантами. Страница доступна только в окружениях local и stage.',
        contents: 'Компоненты',
    },
    layout: {
        skipLink: 'Перейти к содержимому',
    },
    models: {
        label: 'Бренд и модель',
        placeholder: 'Например, Fender American Vintage ’57 Stratocaster',
        hint: 'Как пишет производитель, латиницей',
        empty: 'Такой модели нет в справочнике. Она сохранится как введена и уйдёт на проверку.',
        errorNetwork: 'Не удалось получить подсказку. Текст сохранится как введён.',
        errorLimited: 'Слишком много запросов. Подождите минуту и попробуйте снова.',
        found: (count: number) => `Найдено: ${count}`,
        notFound: 'Ничего не найдено',
        listLabel: 'Модели из справочника',
    },
    header: {
        sectionsLabel: 'Разделы',
        sections: {
            catalog: 'Каталог',
            flea: 'Барахолка',
            parts: 'Аксессуары',
            masters: 'Мастера',
            guide: 'Цены продаж',
        },
        messages: 'Сообщения',
        favorites: 'Избранное',
        notifications: 'Уведомления',
        categories: 'Категории',
        searchPlaceholder: 'Гитары, педали, синтезаторы',
        searchPlaceholderWithMasters: 'Гитары, педали, синтезаторы, мастера',
        defaultCity: 'Москва',
        sell: 'Продать инструмент',
        login: 'Войти',
    },
    city: {
        label: 'Выбор города',
        close: 'Закрыть окно выбора города',
        search: 'Поиск города',
        popular: 'Популярные города',
        found: 'Найденные города',
        loading: 'Загружаем города…',
        empty: 'Такого города нет в списке. Проверьте написание.',
        loadError: 'Не удалось загрузить города. Закройте окно и откройте его снова.',
        saveError: 'Не удалось сменить город. Попробуйте ещё раз.',
    },
    categoryMenu: {
        label: 'Все категории',
        navLabel: 'Категории',
        servicesLabel: 'Сервисы',
        close: 'Закрыть меню',
        back: 'Все категории',
        more: (count: number) => `Ещё ${count}`,
        services: {
            masterCheck: 'Проверка мастером перед покупкой',
            salePrices: (kind: string) => `Цены продаж: ${kind}`,
            safeDeal: 'Как работает безопасная сделка',
            delivery: 'Доставка в защитной упаковке',
            sell: (kind: string) => `Продать ${kind}`,
        },
    },
    tabBar: {
        label: 'Нижнее меню',
        home: 'Главная',
        search: 'Поиск',
        sell: 'Продать',
        messages: 'Сообщения',
        /** Подпись вкладки со счётчиком непрочитанных: «Сообщения, 3». */
        messagesLabel: (count: string) => `Сообщения, ${count}`,
        account: 'Кабинет',
    },
    footer: {
        services: {
            catalog: 'Каталог',
            flea: 'Барахолка',
            parts: 'Аксессуары',
            masters: 'Мастера',
            salePrices: 'Цены на б/у',
            safeDeal: 'Безопасная сделка',
            delivery: 'Доставка с упаковкой',
        },
        about: {
            title: 'О ЯМузыканте',
            links: ['О проекте', 'Вакансии', 'Журнал', 'Для прессы'],
        },
        sellers: {
            title: 'Продавцам',
            titleWithMasters: 'Продавцам и мастерам',
            sell: 'Продать инструмент',
            partners: 'Магазинам-партнёрам',
            becomeMaster: 'Стать мастером',
            workshop: 'Кабинет мастерской',
        },
        useful: {
            title: 'Полезно',
            howToChoose: 'Как выбрать б/у инструмент',
            salePrices: 'Цены на б/у',
            rules: 'Правила размещения',
            legalDocs: 'Правовые документы',
        },
        safety: {
            title: 'Безопасность',
            safeDeal: 'Как работает безопасная сделка',
            fraud: 'Как не попасть на мошенников',
            disputes: 'Споры и возвраты',
        },
        social: ['Telegram', 'ВКонтакте', 'MAX'],
    },
    breadcrumbs: {
        label: 'Хлебные крошки',
        home: 'Главная',
    },
    pagination: {
        label: 'Страницы',
        page: (page: number) => `Страница ${page}`,
        prev: 'Назад',
        next: 'Вперёд',
    },
    flea: {
        title: 'Барахолка',
        lead: 'Б/у инструменты от частных продавцов вашего города.',
        found: (count: number) => `Найдено ${count.toLocaleString('ru-RU')} ${lots(count)}`,
        shown: (shown: number, total: number) =>
            `Показано ${shown.toLocaleString('ru-RU')} из ${total.toLocaleString('ru-RU')}`,
        more: 'Показать ещё',
        shipping: 'Доставка',
        filters: {
            title: 'Фильтры',
            toggle: 'Фильтры',
            reset: 'Сбросить все',
            active: 'Выбранные фильтры',
            category: 'Категория',
            allCategories: 'Все категории',
            condition: 'Состояние',
            price: 'Цена',
            priceFrom: 'от',
            priceTo: 'до',
            priceFromPlaceholder: '0',
            priceToPlaceholder: 'любая',
            currency: '₽',
            deal: 'Покупка и доставка',
            negotiable: 'Готов к торгу',
            ship: 'Доставка',
            priceChipFrom: (price: string) => `от ${price}`,
            priceChipTo: (price: string) => `до ${price}`,
        },
        sort: {
            label: 'Сортировка',
            relevance: 'По релевантности',
            new: 'Сначала свежие',
            cheap: 'Сначала дешевле',
            expensive: 'Сначала дороже',
        },
        empty: {
            filtered: 'По этим фильтрам лотов нет. Уберите часть фильтров.',
            reset: 'Сбросить фильтры',
            city: 'В вашем городе пока нет объявлений.',
        },
    },
} as const;
