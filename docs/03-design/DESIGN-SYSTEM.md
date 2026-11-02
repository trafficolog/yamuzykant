# Дизайн-система в реализации

Источник — `design/ds/` (выгрузка ДС «ЯМузыкант»: Onest, мятный акцент, классы `ym-*`). Бренд-бук и принципы — `design/ds/docs/brand-book.ru.md`, `design/ds/README.md`. Каждый компонент описан тремя файлами: `*.d.ts` (пропсы), `*.prompt.md` (когда и как применять), `*.card.html` (все состояния — открыть в браузере).

## 1. Приоритет источников

1. **Вид, токены, состояния** — ДС. Если прототип отличается от компонента ДС, делаем как в ДС.
2. **Состав экрана, порядок блоков, тексты** — прототип `design/prototypes/*.dc.html` + словарь `AGENTS.md §5`.
3. **Поведение** — карточка задачи и `SPEC.md`.

Прототипы собраны на ДС предыдущей версии через слой `ym-compat.css`. Старые имена в макетах (`lad`, `copper`, `brass`, `nickel`, `lm-*`, `h1`, `body`) в коде не используем — только новые (§3).

## 2. Подключение

`resources/css/app.css` — строго в этом порядке:
```css
@import "../js/ds/tokens/webfonts.css";
@import "../js/ds/tokens/tokens.css";
@import "../js/ds/tokens/page.css";
@import "../js/ds/tokens/components.css";
@import "../js/ds/tokens/forms.css";
```
`ym-compat.css` в приложение **не** подключается — это только для прототипов.

Компоненты: `import { ListingCard, Button, FilterChip } from '@ds'`. Список экспортов — `resources/js/ds/index.ts`, его генерирует `npm run ds:sync`.

## 3. Токены

| Группа | Токены | Правило |
|---|---|---|
| Поверхности | `--surface`, `--surface-raised`, `--surface-recessed`, `--surface-inverse` | Фон страницы, карточки, подложки, тёмные блоки |
| Текст | `--ink`, `--ink-muted`, `--ink-faint`, `--ink-inverse` | Контраст ≥ 4.5:1 для основного текста — только `ink` и `ink-muted` |
| Линии | `--line`, `--line-strong`, `--line-control` | Разделители, рамки панелей, рамки полей |
| Акцент | `--accent`, `--accent-strong`, `--accent-soft`, `--accent-text` | Основное действие, активное состояние. Мятный `accent` как цвет текста на светлом фоне не применяется — для текста `accent-text` |
| Направления | `--service*` (мастера), `--parts*` (детали), `--guide*` (цены продаж) | В MVP используются только в бейджах; не смешивать |
| Статусы | `--success*`, `--warning*`, `--danger*`, `--info*` | Только для статусов, не для украшения |
| Типографика | классы `type-display`, `type-h1…h4`, `type-body`, `type-body-s`, `type-label`, `type-caption`, `type-mono` | Своих размеров шрифта не задаём |
| Отступы | `--space-1…--space-24` (шаг 4 px) | Только из шкалы |
| Радиусы | `--radius-sm/md/lg/full` | |
| Ширина | `--content-max` | Контейнер страницы |

Точные значения — `design/ds/tokens/tokens.css` и `tokens.json`. Значения из этой таблицы в код не копируются: только `var(--…)`.

## 4. Компоненты и где они в MVP

| Компонент | Файл | Экраны MVP | Замечания |
|---|---|---|---|
| Wordmark | core/Wordmark.jsx | шапка, подвал, письма | 24 px в шапке и подвале, 20 px в консоли и письмах; `mono` на заливках |
| Icon | core/Icon.jsx | везде | только иконки из набора ДС |
| Header | core/Header.jsx | — | **не используем**: текст «Продать гир», нет города и меню. Шапка — своя композиция `SiteHeader` по прототипу `Шапка.dc.html` из Wordmark, SearchBar, Button, IconButton |
| Footer | core/Footer.jsx | все публичные | подключаем как есть; MAX вместо YouTube передаём пропсом |
| Button, IconButton | actions/ | везде | `primary` — одно на экран |
| FavoriteButton | actions/ | карточка, лот | |
| SearchBar | forms/ | шапка, Барахолка | |
| FilterChip | forms/ | фильтры, шаги формы, выбор состояния | `radio` для одиночного выбора |
| Field, Textarea, Select, Checkbox, Radio | forms/ | форма продажи, профиль, окна | |
| Badge, ConditionBadge | display/ | карточки, лот, кабинет | ConditionBadge — только 8 ступеней |
| PriceTag | display/ | карточка, лот | |
| Alert | display/ | формы, кабинет, лот | тон `copper` в макетах = `service` |
| Rating | display/ | — | после MVP |
| ListingCard | commerce/ | главная, Барахолка, лот, продавец, превью в форме | без рамки и тени |
| SellerCard | commerce/ | лот, продавец | |
| CatalogSwitch | commerce/ | — | после MVP (каталог новых) — скрыть флагом `catalog_new` |
| PriceGuide, OfferList, ModelSummary | commerce/ | — | после MVP — флаг `sale_prices` |
| TrustStrip | commerce/ | главная | тексты — пропсом `items` (в умолчаниях есть «Фермата») |
| AccessoryCard, AccessoryRail, FitmentBadge | — | — | после MVP |
| MasterCard, ServicePicker, RepairOrderCard, PassportCard, Timeline | service/ | — | после MVP; Timeline можно использовать для статуса объявления в кабинете |

## 5. Композиции проекта (`resources/js/Components`)

Создаются в задачах фазы 0–2, собираются только из компонентов ДС и токенов:
`SiteHeader`, `CitySelect`, `CategoryMenu`, `MobileTabBar`, `PublicLayout`, `AccountLayout`, `PhotoUploader`, `SellStep`, `OfferComposer`, `OfferCard`, `ChatThread`, `ConversationList`, `ComplaintDialog`, `LoginDialog`, `EmptyState`, `Breadcrumbs`, `Pagination`.

Каждая композиция — с тестом Vitest и снимком в `/_ds` (страница-витрина в local и stage).

## 6. Сверка с эталонами

- Эталоны — `design/screens/{screen-id}@1440.png` и `@390.png`, полный экран (fullPage). Создаются из прототипов скриптом `tools/capture-reference.mjs` по `design/screens/manifest.json`.
- Визуальный тест — Playwright `toHaveScreenshot` с маской на динамических зонах (фото, даты, счётчики): `mask` из `manifest.json`.
- Порог: `maxDiffPixelRatio: 0.02` для публичных экранов; `0.05` — для экранов, где реализация законно отличается данными (выдача, чат). Консоль на Filament визуально не сравнивается — для неё проверка состава по чек-листу `SCREENS.md`.
- Расхождение выше порога — либо исправление, либо запись в `design/DEVIATIONS.md` (экран, что отличается, почему, кто принял).

## 7. Состояния

Для каждого интерактивного элемента проверяются применимые из 8: `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`, `error`, `success`. Компоненты ДС реализуют их сами. Композиции проекта обязаны пробросить `disabled`, `loading` и `error` в компоненты ДС, а не рисовать свои. Для каждого экрана в `SCREENS.md` перечислены состояния экрана (пусто, загрузка, ошибка, нет доступа).

## 8. Доступность и адаптив

- Зона нажатия ≥ 44 px, фокус — кольцо ДС `--focus-ring`, не убирать `outline`.
- Брейкпоинты: < 640 px — мобильная раскладка (MobileTabBar: Главная, Поиск, Продать, Сообщения, Кабинет); 640–1023 — планшет; ≥ 1024 — десктоп.
- Мобильных прототипов нет: мобильная раскладка строится по `design/ds/ui_kits/marketplace/mobile.html` и правилам ДС, эталоны `@390` снимаются с десктопных прототипов только для шапки и подвала. Остальные мобильные экраны проверяются по чек-листу `SCREENS.md §3` и принимаются OWNER на гейте G3.
