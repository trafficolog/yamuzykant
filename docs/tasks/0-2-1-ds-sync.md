---
id: "0.2.1"
phase: "0"
epic: "0.2"
title: "Подключение дизайн-системы: ds:sync и @ds"
status: review
gate: G0
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["FRONT"]
depends_on: ["0.1.1"]
uc: []
prototype: ""
screens: []
issue: 7
sync_state: drifted
escalations: []
---

# 0.2.1. Подключение дизайн-системы: ds:sync и @ds

## Цель
Компоненты ДС импортируются из `@ds` без переноса и обновляются одной командой.

## Что сделать
- Довести `tools/ds-sync.mjs`: копия `design/ds/components` и `design/ds/tokens` в `resources/js/ds`, генерация `index.ts`
- Алиас `@ds` в vite.config.ts и tsconfig.json; типы из `.d.ts` подхватываются
- `resources/css/app.css` — импорт токенов в порядке DESIGN-SYSTEM.md §2
- Страница `/_ds` (только local и stage): все компоненты из index.ts со всеми вариантами из `*.card.html`
- ESLint-правило: запрет импорта из `resources/js/ds/**` кроме как через `@ds`; запрет правок `resources/js/ds` (CODEOWNERS + проверка в docs-ops)

## Критерии приёмки
- [ ] `npm run ds:sync` идемпотентен: повторный запуск не даёт diff
- [ ] `tsc` видит пропсы ListingCard из `.d.ts`
- [ ] На `/_ds` отрисованы все компоненты без ошибок консоли, шрифт Onest
- [ ] SSR отрисовывает компоненты ДС (нет обращений к window при импорте)
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Vitest: рендер каждого экспорта index.ts без ошибок
- Playwright visual: `/_ds` на 1440 (эталон снимается с реализации и принимается OWNER)

## Не делать
- Не менять файлы ДС; несовместимость с SSR — обёртка в Components, а не правка ДС

## Ссылки
- SPEC: — · docs/00-product/SPEC.md

