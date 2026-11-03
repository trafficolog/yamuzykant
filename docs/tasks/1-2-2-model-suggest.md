---
id: "1.2.2"
phase: "1"
epic: "1.2"
title: "Подсказка модели"
status: done
gate: G1
risk: low
model_impl: haiku
model_review: sonnet
roles: ["BACK", "FRONT"]
depends_on: ["1.2.1"]
uc: ["L1"]
prototype: "Десктоп - Продать.dc.html"
screens: []
issue: 19
sync_state: aligned
escalations: []
---

# 1.2.2. Подсказка модели

## Цель
При вводе «бренд и модель» продавец видит модели из справочника.

## Что сделать
- Индекс моделей в Meilisearch с синонимами («стратокастер» → Stratocaster)
- `GET /api/models?q=` ≤ 100 мс, 8 результатов
- Ввод без выбора → сохраняется текстом, создаётся модель `suggested`

## Критерии приёмки
- [ ] «стратокастер» находит Fender Stratocaster
- [ ] Опечатка в одну букву находит модель
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature с настоящим Meilisearch
- Vitest: автодополнение клавиатурой

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-L1 · docs/00-product/SPEC.md
- Макет: design/prototypes/Десктоп - Продать.dc.html
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
