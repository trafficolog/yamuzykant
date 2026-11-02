# Экраны MVP

Экран → макет → состояния → гейт. Эталоны: `design/screens/{id}@{1440|390}.png`. Машинная версия — `design/screens/manifest.json`.

## 1. Публичные и кабинет

| id | Макет | Гейт | Состояния |
|---|---|---|---|
| `header` | Шапка | G0 (окно входа — G1) | default, categories-open, search-focus, logged-in, login-dialog: method, email-code, first-login, error |
| `footer` | Подвал | G0 | default |
| `home` | Десктоп - Главная | G1 | default, loading, empty-city |
| `flea` | Десктоп - Каталог `?view=flea` | G1 | default, filters-applied, loading |
| `flea-empty` | Десктоп - Каталог `?view=flea&empty=1` | G1 | empty |
| `lot` | Десктоп - Лот | G1 | default, own-listing, withdrawn, favorite-on |
| `seller` | Десктоп - Продавец | G1 | default, no-listings |
| `sell` | Десктоп - Продать | G1 | empty, partially-filled, ready, published, sent (при `premoderation`), contacts-blocked, limit-reached |
| `messages` | Десктоп - Сообщения | G1 (offer-* — G2) | list, thread, offer-waiting, offer-accepted, empty |
| `account` | Десктоп - Кабинет | G1 | overview, listings, favorites, searches, profile, needs-changes |
| `help` | Десктоп - Помощь | G2 | default, article, contact-form |
| `error` | Десктоп - Ошибка | G2 | 404, 500, 503 |
| `emails` | Письма и уведомления | G1: login-code, new-message · G2: остальные | login-code, moderation-approved, moderation-returned, new-message, offer, saved-search |
| `console-moderation` | Десктоп - Модерация | G2 | queue, decision |
| `console-overview` | Админ - Обзор | G2 | default |
| `console-tickets` | Админ - Обращения | G2 | list, detail |
| `console-users` | Админ - Пользователи | G2 | list, detail, restrict |
| `console-dictionaries` | Админ - Справочники | G2 | categories, models, suggested |
| `console-staff` | Админ - Сотрудники | G2 | list, roles |
| `console-log` | Админ - Журнал | G2 | default, filtered |

## 2. Что скрыть флагами на экранах MVP

| Экран | Элемент макета | Флаг |
|---|---|---|
| header | вкладки «Каталог», «Аксессуары», «Мастера», «Цены продаж» | `catalog_new`, `accessories`, `masters`, `sale_prices` |
| home | рельсы новых товаров, мастеров, аксессуаров | те же |
| flea | переключатель Каталог / Барахолка (CatalogSwitch); чип «Безопасная сделка» | `catalog_new`, `safe_deal` |
| lot | блок проверки мастером, справочник цен, аксессуары | `masters`, `sale_prices`, `accessories` |
| sell | справочник цен (PriceGuide), блок «Проверка мастером» | `sale_prices`, `masters` |
| account | вкладки «Компания», «Мастерская», «Кошелёк», «Мои инструменты» | `companies`, `masters`, `wallet`, `accessories` |
| footer | ссылки на разделы вне MVP | те же |

Флаги выключены в R1. Код скрытых блоков не пишется: на их месте условный рендер ничего не выводит, и раскладка от этого не ломается.

## 3. Чек-лист экрана (для экранов без эталона и для мобильной раскладки)

- [ ] Порядок блоков как в макете; тексты — из макета с учётом словаря.
- [ ] Только компоненты `@ds` и композиции проекта.
- [ ] Состояния экрана: загрузка (скелетоны ДС, без «прыжков» раскладки), пусто (EmptyState с действием), ошибка (Alert с повтором), нет доступа (403 → вход).
- [ ] 320 px — без горизонтальной прокрутки; зона нажатия ≥ 44 px; MobileTabBar на < 640 px.
- [ ] Заголовок страницы `<title>` и `<h1>` совпадают по смыслу; хлебные крошки один раз.
- [ ] axe чистый, Tab-порядок совпадает с визуальным.

## 4. Консоль (Filament)

Макеты `Админ - *` и `Десктоп - Модерация` задают **состав и поведение**: разделы меню, колонки таблиц, фильтры, действия, причины, подтверждения. Визуально — стандарт Filament с темой на токенах ДС (цвет `accent`, шрифт Onest, Wordmark 20 px). Сверка — по чек-листу: каждый раздел меню, колонка, фильтр и действие из макета есть в реализации или записан в `DEVIATIONS.md`.

## 5. После MVP

`catalog-new` — Десктоп - Каталог · `model` — Десктоп - Модель · `sale-prices` — Десктоп - Цены продаж · `masters` — Десктоп - Мастера · `master` — Десктоп - Мастер · `accessories` — Десктоп - Аксессуары · `plans` — Десктоп - Тарифы · `console-partners` — Админ - Проверка · `console-money` — Админ - Деньги · `console-showcase` — Админ - Витрина. Эталоны для них не снимаются до начала соответствующего релиза.
