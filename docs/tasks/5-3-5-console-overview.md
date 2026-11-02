---
id: "5.3.5"
phase: "5"
epic: "5.3"
title: "Обзор консоли"
status: todo
gate: G2
risk: low
model_impl: haiku
model_review: sonnet
roles: ["FRONT", "BACK"]
depends_on: ["5.1.2", "5.2.3"]
uc: []
prototype: "Админ - Обзор.dc.html"
screens: ["console-overview"]
issue: null
sync_state: drifted
escalations: []
---

# 5.3.5. Обзор консоли

## Цель
Сотрудник видит, что требует внимания.

## Что сделать
- Виджеты из макета, доступные в MVP: очередь модерации (размер, старейшее), обращения, жалобы, медиана модерации, новые объявления за сутки
- Виджеты вне MVP — не показываем

## Критерии приёмки
- [ ] Цифры совпадают с запросами к БД (тест)
- [ ] Виджет виден только ролям, у которых есть раздел
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature: метрики

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: — · docs/00-product/SPEC.md
- Макет: design/prototypes/Админ - Обзор.dc.html · эталоны: design/screens/console-overview@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
