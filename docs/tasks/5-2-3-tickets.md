---
id: "5.2.3"
phase: "5"
epic: "5.2"
title: "Обращения и жалобы в консоли"
status: todo
gate: G2
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["BACK", "FRONT"]
depends_on: ["5.2.1", "5.2.2", "5.3.1"]
uc: ["O2"]
prototype: "Админ - Обращения.dc.html"
screens: ["console-tickets"]
issue: 47
sync_state: drifted
escalations: []
---

# 5.2.3. Обращения и жалобы в консоли

## Цель
Сотрудник разбирает жалобы и обращения в одном месте.

## Что сделать
- Filament-ресурс: список с фильтрами (тип, статус, приоритет, ответственный), карточка с перепиской и объектом жалобы
- Статусы §6.3; ответ пользователю уходит письмом и уведомлением
- Быстрые действия: скрыть объявление, ограничить пользователя (5.3.2)

## Критерии приёмки
- [ ] Состав совпадает с макетом (чек-лист)
- [ ] Сообщение пользователя переводит waiting_user → in_progress
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature: статусы, права
- Playwright UC-O2.spec.ts

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-O2 · docs/00-product/SPEC.md
- Макет: design/prototypes/Админ - Обращения.dc.html · эталоны: design/screens/console-tickets@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
