---
id: "0.2.4"
phase: "0"
epic: "0.2"
title: "PublicLayout: шапка и подвал"
status: todo
gate: G0
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["FRONT"]
depends_on: ["0.2.1", "0.2.3", "0.1.6"]
uc: ["S1"]
prototype: "Шапка.dc.html, Подвал.dc.html"
screens: ["header", "footer"]
issue: null
sync_state: drifted
escalations: []
---

# 0.2.4. PublicLayout: шапка и подвал

## Цель
Общий каркас публичных страниц по макетам.

## Что сделать
- `Components/SiteHeader`: Wordmark, SearchBar, кнопка «Продать инструмент», город, иконки сообщений/избранного/уведомлений, вход; строка разделов (вне MVP — по флагам); меню категорий
- `Footer` ДС; ссылки на разделы вне MVP — по флагам; MAX вместо YouTube
- `Layouts/PublicLayout` с `<Head>` и skip-link
- Пропсы `active` и `search` как в прототипе

## Критерии приёмки
- [ ] Шапка и подвал в пороге эталонов `header`, `footer` на 1440
- [ ] Кнопки и поиск в шапке одной высоты (48 px)
- [ ] Меню категорий открывается с клавиатуры, закрывается по Esc и клику вне
- [ ] Активный раздел — `aria-current="page"`
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Playwright visual: header, footer
- Vitest: SiteHeader с флагами on/off
- Playwright a11y: меню категорий

## Не делать
- Не реализовывать вход и выбор города — 1.1.2 и 1.1.4; здесь только кнопки

## Ссылки
- SPEC: UC-S1 · docs/00-product/SPEC.md
- Макет: design/prototypes/Шапка.dc.html, Подвал.dc.html · эталоны: design/screens/header@{1440,390}.png, design/screens/footer@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
