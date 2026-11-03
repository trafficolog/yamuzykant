---
id: "0.2.8"
phase: "0"
epic: "0.2"
title: "Самохостинг шрифтов ДС"
status: review
gate: G1
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["FRONT", "SEC"]
depends_on: ["0.2.1"]
uc: []
prototype: ""
screens: []
issue: 82
sync_state: drifted
escalations: []
---

# 0.2.8. Самохостинг шрифтов ДС

## Цель
Шрифты Onest и JetBrains Mono отдаются с нашего сервера: IP посетителей не уходит Google (152-ФЗ), загрузка не зависит от стороннего сервиса (решение OWNER 03.11.2026, аудит G0 R4).

## Что сделать
- woff2 Onest и JetBrains Mono (начертания, которые использует ДС; кириллица и латиница) — в `public/fonts` или через сборку Vite; лицензии OFL — в репозиторий
- `@font-face` в `resources/css/app.css`; импорт `webfonts.css` ДС с Google Fonts не подключается (сам `resources/js/ds/**` не правится — меняется порядок импортов в app.css)
- `font-display: swap`, `preload` основного начертания в шаблоне
- Задача OWNER на стороне ДС: убрать Google Fonts из `webfonts.css` в исходной ДС (Claude Design), чтобы следующий `ds:sync` не вернул импорт

## Критерии приёмки
- [ ] Ни одна страница не делает запросов к `fonts.googleapis.com` и `fonts.gstatic.com` (Playwright: перехват сети)
- [ ] Шрифт Onest применяется на `/` и `/_ds` (проверка `document.fonts` с реальным `@font-face`, а не `fonts.check`)
- [ ] Визуальные тесты зелёные без пересъёмки эталонов (или пересъёмка с объяснением)
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Playwright: перехват запросов к доменам Google; загрузка шрифта из своего origin

## Не делать
- Править `resources/js/ds/**` и `design/ds/**`

## Ссылки
- Аудит G0 (docs/operations/gates/G0.md, R4) · сессия 0.2.1 · SPEC §9 (ПДн, LCP)
