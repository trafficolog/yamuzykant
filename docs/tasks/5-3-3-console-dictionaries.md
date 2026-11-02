---
id: "5.3.3"
phase: "5"
epic: "5.3"
title: "Справочники в консоли"
status: todo
gate: G2
risk: low
model_impl: haiku
model_review: sonnet
roles: ["BACK", "FRONT"]
depends_on: ["5.3.1", "1.2.1"]
uc: ["O4"]
prototype: "Админ - Справочники.dc.html"
screens: ["console-dictionaries"]
issue: null
sync_state: drifted
escalations: []
---

# 5.3.3. Справочники в консоли

## Цель
Администратор ведёт категории, модели, причины модерации, стоп-слова.

## Что сделать
- Ресурсы: категории (дерево, порядок), модели (слияние дублей, разбор «Предложено продавцами»), причины, стоп-слова, статьи помощи

## Критерии приёмки
- [ ] Слияние моделей переносит объявления и переиндексирует
- [ ] Состав совпадает с макетом (чек-лист)
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature: слияние, права
- Playwright UC-O4.spec.ts

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-O4 · docs/00-product/SPEC.md
- Макет: design/prototypes/Админ - Справочники.dc.html · эталоны: design/screens/console-dictionaries@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
