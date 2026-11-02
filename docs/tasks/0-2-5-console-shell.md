---
id: "0.2.5"
phase: "0"
epic: "0.2"
title: "Консоль сотрудников: каркас Filament"
status: todo
gate: G2
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["BACK", "FRONT"]
depends_on: ["0.1.1"]
uc: []
prototype: "Админ - Меню.dc.html, Админ - Шапка.dc.html"
screens: ["console-overview"]
issue: 11
sync_state: drifted
escalations: []
---

# 0.2.5. Консоль сотрудников: каркас Filament

## Цель
Панель `/console` с меню из макета и темой на токенах ДС.

## Что сделать
- Filament 3, панель `console`, guard `staff` (модель `Staff`), вход логин + пароль (2FA — в 5.3.1)
- Тема: цвет accent, Onest, Wordmark 20 px
- Группы меню из `Админ - Меню.dc.html`: пустые страницы-заглушки разделов MVP
- Записать отличия в design/DEVIATIONS.md

## Критерии приёмки
- [ ] `/console` недоступна пользователю площадки (403/редирект)
- [ ] Меню совпадает по составу и порядку с макетом (чек-лист SCREENS.md §4)
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature: доступ guest/user/staff к /console

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: — · docs/00-product/SPEC.md
- Макет: design/prototypes/Админ - Меню.dc.html, Админ - Шапка.dc.html · эталоны: design/screens/console-overview@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
