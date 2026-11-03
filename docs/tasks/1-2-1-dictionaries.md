---
id: "1.2.1"
phase: "1"
epic: "1.2"
title: "Справочники: категории, модели, города"
status: in_progress
gate: G1
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["DB", "BACK"]
depends_on: ["0.1.2"]
uc: ["O4"]
prototype: "Админ - Справочники.dc.html"
screens: []
issue: 18
sync_state: drifted
escalations: []
---

# 1.2.1. Справочники: категории, модели, города

## Цель
Справочники, на которые опираются объявления, поиск и фильтры.

## Что сделать
- categories (дерево: 8 видов + подкатегории из меню категорий шапки), instrument_models (brand, name, year_from, year_to, category_id), cities (name, region, lat, lng)
- Сиды: категории из `Шапка.dc.html`, ~50 моделей, города-миллионники
- Статус модели: `active`, `suggested` (предложено продавцом), `hidden`

## Критерии приёмки
- [ ] Категории и порядок совпадают с меню категорий макета
- [ ] Скрытая категория не видна в публичных props
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest unit: дерево категорий
- Pest feature: публичные props без скрытых

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-O4 · docs/00-product/SPEC.md
- Макет: design/prototypes/Админ - Справочники.dc.html
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
