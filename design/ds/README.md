# ЯМузыкант — Design System

> **Rebrand, 31 Oct 2026:** the system is now **ЯМузыкант** (source: `uploads/yamuzykant-design-system/`, brand book in `docs/brand-book.ru.md`). Components, tokens and CSS were regenerated 1:1 from its `components/bundle.js`, `bundle.css`, `tokens.css` and `index.d.ts`. Key changes: class prefix `ym-`; mint `--accent` (#2fd67b, dark text on fill) replaces `--lad`; direction tokens are now `--service` (Мастера), `--parts` (Аксессуары), `--guide` (Цены на б/у); font **Onest** (Google Fonts) replaces Golos/Unbounded; type classes `type-h1`, `type-body`, `type-price`…; scale `--text-s` 13 → `--text-6xl` 40; radii 6/10/20/28; reference shifted to a dense Яндекс-Маркет-style storefront (`docs/01-market.ru.md`). The source's `prefers-color-scheme` auto-dark was removed on purpose: light everywhere, dark only inside `[data-theme="dark"]`. Sections below that mention lad/copper/nickel/brass or Golos describe the previous iteration — the brand book wins where they differ.


**ЯМузыкант** — маркетплейс нового, б/у и винтажного музыкального оборудования, где рядом с лотами работают мастера: проверка перед покупкой, ремонт и запчасти с подбором по совместимости. Слоган: **«Приведём гир в лад»**. Interface metaphor: a calm workshop — gear photos first, exact numbers, every promise has its own colour.

## Sources
- **Primary:** https://github.com/trafficolog/tonika/tree/main/references — `references/design-system/` (brand book, `tokens.css`/`tokens.json`, `components/bundle.js`+`bundle.css`+`index.d.ts`, per-component READMEs, 43 Lucide SVGs, `gallery.html`) and `references/screenshots/` (foundations + 29 components, desktop 1200 px and phone 390 px, light + dark). Originally published as the Claude artifact https://claude.ai/artifact/MJpi9h8gTKsUFz1T7EimhN. Component code, CSS and tokens here are byte-identical to that bundle (verified by diff); types come from its `index.d.ts`. Explore the repo for anything not mirrored here.
- **Functional reference only:** https://github.com/trafficolog/tonika — an early demo («Тоника»). Its *features* carry over (паспорт инструмента, «Ищу», ремонт и мастерские, operator moderation, calm «вы» tone); its name, imagery and visuals do **not**. Explore it for domain logic, not for look.
- **Benchmarks** (structure, not style): https://reverb.com/ and Behance «marketplace» — https://www.behance.net/search/projects/marketplace. The artifact's own Reverb/Behance research is summarised below.

## Products / surfaces
- **ЯМузыкант·Рынок** — Каталог (models + new from partners) and Барахолка (used lots, freshest first). Card: `ListingCard`. Colour: lad.
- **ЯМузыкант·Мастера** — repair, service, pre-purchase inspection. `MasterCard`, `ServicePicker`, `RepairOrderCard`. Colour: copper.
- **ЯМузыкант·Детали** — accessories & parts fitted to «Мой гир». `AccessoryCard`, `FitmentBadge`. Colour: nickel.
- **Ля440** — price guide from real sales. `PriceGuide`. Colour: brass.
- **Фермата** — escrow («деньги ждут, пока покупатель проверит гир»). lad. **Паспорт инструмента** — history by serial number. copper.
- Instrument type (Гитары, Педали и усилители, Клавишные и синтезаторы, Студия и запись, Ударные, Духовые, Смычковые, DJ) is the shared axis across all sections. URLs: `/gitary/elektro`, `/gitary/elektro/baraholka`, `/model/…`, `/lot/…`, `/mastera/gitary/…`.

## CONTENT FUNDAMENTALS
- Speak like an experienced master behind the counter: short, to the point, **на «вы»**. «Мастер посмотрит инструмент до отправки», not «Наши эксперты обеспечат качество».
- Buttons: verb first, sentence case: «Купить с Ферматой», «Предложить цену», «Записаться к мастеру». Labels never wrap (`nowrap`) — shorten instead.
- Musical words only in the feature names of the vocabulary (Ля440, Фермата, «По рукам!», Кофр-доставка). No puns in errors or money: «Оплата не прошла. Попробуйте СБП или другую карту.»
- Gear jargon is fine where musicians use it: «гир», «сетап», «перешлифовка ладов», «Made in Japan». Model names as the maker writes them, in Latin: «Fender American Vintage ’57 Stratocaster».
- Prices: non-breaking thousands + « ₽» after: «184 500 ₽». Range with spaced en dash: «168 000 – 196 000 ₽». Dates: «3 окт» in UI, ДД.ММ.ГГГГ (mono) in passport/docs.
- No emoji, no exclamation marks (only «По рукам!»), no «Ой», no apologies.
- Condition only on the 8-step scale: Новое · Как новое · Отличное · Очень хорошее · Хорошее · Удовлетворительное · Плохое · На запчасти (used get «Б/у ·» prefix).
- No eyebrows on sections, no section numbers. `eyebrow` only for real sequences («Шаг 2 из 4»).
- All numbers in examples are placeholders — mark unknown metrics «уточнить».

## VISUAL FOUNDATIONS
- **Theme:** light only, everywhere — no dark theme, OS dark mode is ignored (`color-scheme: only light`).
- **Colour:** tinted near-white neutrals with a slight green bias. Three depth steps: `surface` (page) → `surface-raised` (panels, menus, fields) → `surface-recessed` (photo beds, filter sidebar). Text `ink` / `ink-muted` / `ink-faint`. Brand `lad #0a7a4a` = primary action + success. Each direction owns one accent and never borrows another's (no copper in checkout, no green in a master's estimate except payment). Signal colours only for statuses. Colour is never the only carrier of meaning. **Light is the default everywhere** (OS dark mode is ignored; `color-scheme: only light`). A dark variant exists only inside an explicit `[data-theme="dark"]` scope — Brand and Colors cards show both, product screens stay light. `inverse` in light = light neutral #e9ece6 with ink text (secondary button, search button, solid badge, toasts, footer); in dark = #eef0ec with ink-dark text.
- **Type:** Golos Text (all UI incl. prices), Unbounded (wordmark, promo, brand module names — never prices/buttons), JetBrains Mono (serials, order numbers, passport dates). Sizes only from the scale 12/14/16/18/24/32/36/48. Headings upright, `text-wrap: balance`. Tabular numerals for all figures.
- **Spacing:** 4px step (`space-1…16`). Card grid gap 24, page margin 40 desktop / 16 phone, 64 between home rails. Grid = `auto-fill, minmax(220px)`, 136px on phones (2 columns at 320). Max width 1440. `overflow-x: clip` on html/body.
- **Radii by role:** xs 4 badges · sm 8 fields · md 12 alerts · lg 16 cards/gallery/panels · xl 24 modals/sheets · full — buttons, chips, search, avatars.
- **Controls:** 32 / 40 / 48 (default) / 56 (lot primary). Hit area ≥ 44 via invisible `::after`.
- **Cards:** listing card has **no border and no shadow** — square photo on surface-recessed, radius 16, price above title; hover = title underline only. Panels (SellerCard, MasterCard) separate with a `line` border, no shadow.
- **Shadows by role only:** shadow-1 heart & chips over photos, shadow-2 menus, shadow-3 modals/toasts.
- **Backgrounds & imagery:** no gradients, no glass/blur, no illustrations or mascots, no stock people. Lot photo 1:1 in cards, 4:3 gallery; never crop or blur the background; ≥ 3 photos, serial-number shot required. Faces of sellers/masters not shown — initials avatars (nickel-soft seller, copper-soft master). Empty states: 40px icon on surface-recessed + one sentence.
- **Brand graphic (cover art):** the one sanctioned composition — rounded slabs in direction colours (lad largest = brand, copper = Мастера, nickel = Детали) hanging from the top edge, a brass pill (Ля440 range bar) and an inverse «fretboard» band with surface-coloured inlay dots at frets 3·5·7·9 and a double dot at 12, spaced by the 12-tone fret rule. Corners radius-lg, gutters space-4, discs r = space-2, slabs bleed off the top/right. Wordmark sits bottom-left (Unbounded 56/0.95, −0.03em) with the slogan in body-s ink-muted. Recolours automatically in dark theme. File: `assets/brand/cover-art.svg`; card: `guidelines/brand-cover.html`. Use for covers, promo, presentations — not inside product screens.
- **States:** every interactive component has 8: default, hover, focus, active, disabled, loading, error, success. Hover only inside `@media (hover:hover)`; one hover reaction per element (button = background colour; card = title underline). Press = 1px shift. Focus = 2px solid `focus-ring`, 2px offset, instant.
- **Motion:** `--ym-ease-out` cubic-bezier(.16,1,.3,1); 120ms micro (colour, press), 220ms short (menus, tooltips). Only colour, transform, opacity animate. No springs/parallax. Reduced-motion disables transitions. Successful actions are silent; toasts only for errors or off-screen events.
- **Layout:** Header = wordmark + full-width search + «Продать гир» + icons, second row = five sections (active underlined lad) | instrument types. Mobile < 640: search moves to row 2, «Продать гир» to bottom tab bar (Главная, Поиск, Продать, Сообщения, Профиль).

## ICONOGRAPHY
- **Lucide** (ISC), 2px stroke, round caps, 24 grid, `currentColor`. The exact 43-icon set is embedded in `components/core/shared.js` (`ICONS`) and rendered via `<Icon name="…"/>`. New icons only from Lucide.
- Sizes: 14–16 badges/chips, 20 buttons/alerts, 22 header, 40 placeholders.
- Section icons: Каталог `layout-grid`, Барахолка `boxes`, Аксессуары `cable`, Мастера `wrench`, Ля440 `sliders-horizontal`; Партнёр `store`, Фермата `shield-check`, «По рукам!» `handshake`, Паспорт `history`, мастера рядом `locate-fixed`.
- No emoji, no icon font, no PNG icons.
- **Logo: none exists yet.** Use `Wordmark` — «ЯМузыкант» in Unbounded 700, «мастер» in lad; `mono` on inverse/lad fills. Don't draw a symbol or stylise letters. Min 16px; clear space = height of «Л».

## Market scope & locale
- **Russia first**, like a national classifieds platform: one country, one currency (₽), Russian only. Location = **city** (+ distance on Барахолка), never a country flag. Rails are local: «Недавно продано в Москве», «Рядом с вами», not «лучшие европейские предложения».
- **CIS later**, possibly as separate national domains (local law). Keep copy, prices and addresses locale-driven: `formatRub` is the only formatter today — add a currency-aware formatter rather than hard-coding «₽» in layouts. Country appears in the UI only once a second market exists (profile → «Регион и доставка», disabled «Россия» for now). Cross-border lots, if ever, show country as a word next to the city, not a flag.
- Payouts and identity follow Russian rules: ИНН, самозанятый / ИП, СБП first among payment methods, ad bumps labelled «Реклама» + ERID.

## Account area (Кабинет)
Structure informed by Reverb's account hub (functions only, own visuals): a second-level tab bar under the Header — Обзор · Покупки · Продажи · Мой гир · Сообщения · Ремонт · Отзывы · Профиль и магазин (icon 16 + label, active = ink 600 with 2px lad underline, links with `aria-current="page"`). Overview: greeting h1, four stat tiles (mono-l numbers on surface-recessed, radius-md), one Alert for what needs action, the Фермата Timeline. Lists filter with radio FilterChips, not side menus. Empty states follow the brand book (40px icon in a surface-recessed circle + one sentence + optional outline button) — **no illustrations or mascots**, unlike Reverb. Settings = two-column rows (title + why on the left, Fields on the right) with one inverse «Сохранить». Security notices (MFA, «общайтесь внутри ЯМузыканта») use Alert, never orange promo banners.

## Reverb & Behance takeaways (from the artifact)
Take from Reverb: neutral light UI where gear photo colour beats brand colour; 4px step, 32/40/48/56 controls, pill buttons, 16 main radius; lot page order (decision → trust → specs); interest counters; 8-step condition scale; price guide as its own module. Change: green lad instead of orange; Golos Text instead of Inter; four colour-coded directions; Фермата & «Проверено мастером» on the card itself; Паспорт instead of model reviews; «Мой гир» fitment; paid bumps marked «Реклама» + ERID. Behance: products are light even when presentations are dark; trust is a visual layer (TrustStrip, Timeline); item history beats model reviews; avoid mascots, candy pastels, neon, gradients, giant hero headlines.

## Index
- `styles.css` → `tokens/fonts.css` (Golos Text, Unbounded, JetBrains Mono woff2 in `fonts/`), `tokens.css` (light only), `scale.css`, `type.css` (text-style classes), `base.css` (motion, body, focus), `components.css` (all `ym-*` component styles).
- `components/` — React primitives (below), plus `core/shared.js` (icons, formatRub, helpers).
- `guidelines/` — foundation cards (Colors, Type, Spacing, Brand).
- `assets/brand/cover-art.svg` — brand cover composition. `assets/reference/` — artifact screenshots (cover, colour, type, scales, icons).
- `ui_kits/marketplace/` — interactive kit: Главная, Каталог/Барахолка, Лот, Модель, Мастера, Кабинет (8 tabs). `index.html` = desktop 1440 card, `mobile.html` = same app at 390 px (two-row Header, 2-column lots, bottom tab bar built from `IconButton`: Главная · Поиск · Продать · Сообщения · Профиль).
- `docs/` — Russian source documents from the repo: `brand-book.ru.md`, `01-reverb.ru.md`, `02-behance.ru.md`, `03-claude-design.ru.md` (screen briefs + pre-handoff checklist), `04-catalog.ru.md` (catalog structure, geolocation, URLs).
- `tokens/tokens.json` — DTCG-style export of every token (light only). `assets/icons/` — the 43 Lucide SVGs + ISC licence.
- `AUDIT.md` — Hallmark audit log.
- `SKILL.md`, `thumbnail.html`.

## Components
- core: **Icon**, **Wordmark**, **Header**, **Footer** (light; full / compact — structure after large classifieds footers: services strip → 4 link columns + support → legal row)
- actions: **Button**, **IconButton**, **FavoriteButton**
- forms: **SearchBar**, **FilterChip**, **Field**
- display: **Badge**, **ConditionBadge**, **PriceTag**, **Rating**, **FitmentBadge**, **Alert**
- commerce: **ListingCard**, **PriceGuide**, **TrustStrip**, **SellerCard**, **CatalogSwitch**, **ModelSummary**, **OfferList**, **AccessoryCard**, **AccessoryRail**
- service: **Timeline**, **MasterCard**, **RepairOrderCard**, **PassportCard**, **ServicePicker**

29 components = the full inventory of `references/design-system/components`, code verbatim from its `bundle.js`; prop types from its `index.d.ts`. Upstream they live on `window.YaMusician`; here the compiled namespace is `window.DesignSystem_b66810` with the same API (`ICONS` replaces `YaMusician.icons`, `formatRub` is exported from `core/shared.js`). Briefs and docs that say `window.YaMusician` work after one alias line: `window.YaMusician = window.DesignSystem_b66810;` (the UI kit does this).


## Intentional additions
- **Checkbox, Radio, Select, Textarea** (`components/forms/`, CSS in `tokens/forms.css`) — added on request (31 Oct 2026); not in the source export. Built on Field's box, label, hint and error language; filled states use `accent`.
