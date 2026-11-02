---
id: "5.3.2"
phase: "5"
epic: "5.3"
title: "Пользователи и ограничения"
status: todo
gate: G2
risk: high
model_impl: opus
model_review: opus
roles: ["BACK", "FRONT"]
depends_on: ["5.3.1"]
uc: ["O3"]
prototype: "Админ - Пользователи.dc.html"
screens: ["console-users"]
issue: null
sync_state: drifted
escalations: []
---

# 5.3.2. Пользователи и ограничения

## Цель
Поддержка находит пользователя и применяет меру по SPEC §6.4.

## Что сделать
- Ресурс «Пользователи»: поиск по имени, части e-mail (маска в списке, полный — по кнопке с записью в журнал), объявлениям
- Карточка: объявления, жалобы, решения, меры
- Меры: warning, no_publish (3/7/30/∞), blocked — причина обязательна; blocked снимает объявления

## Критерии приёмки
- [ ] Просмотр полного e-mail пишет журнал доступа к ПДн
- [ ] Заблокированный не может войти; его объявления withdrawn(moderation)
- [ ] Состав совпадает с макетом (чек-лист)
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature: каждая мера и её последствия
- Pest: журнал доступа к ПДн
- Playwright UC-O3.spec.ts

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-O3 · docs/00-product/SPEC.md
- Макет: design/prototypes/Админ - Пользователи.dc.html · эталоны: design/screens/console-users@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
