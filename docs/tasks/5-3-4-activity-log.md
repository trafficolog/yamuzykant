---
id: "5.3.4"
phase: "5"
epic: "5.3"
title: "Журнал действий"
status: todo
gate: G2
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["BACK", "FRONT"]
depends_on: ["5.3.1"]
uc: ["O6"]
prototype: "Админ - Журнал.dc.html"
screens: ["console-log"]
issue: null
sync_state: drifted
escalations: []
---

# 5.3.4. Журнал действий

## Цель
Любое действие сотрудника можно найти и нельзя изменить (BR-07).

## Что сделать
- spatie/activitylog для всех действий консоли и мер; таблица только на запись (права БД или триггер)
- Страница: фильтры (сотрудник, тип, объект, период), экспорт CSV для admin

## Критерии приёмки
- [ ] UPDATE и DELETE журнала запрещены на уровне БД (тест)
- [ ] Каждое действие из 5.1–5.3 оставляет запись (тест)
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature: запись на каждое действие
- Pest: запрет изменения
- Playwright UC-O6.spec.ts

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-O6 · docs/00-product/SPEC.md
- Макет: design/prototypes/Админ - Журнал.dc.html · эталоны: design/screens/console-log@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
