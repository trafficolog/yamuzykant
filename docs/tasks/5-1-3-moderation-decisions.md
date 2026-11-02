---
id: "5.1.3"
phase: "5"
epic: "5.1"
title: "Решения модерации и уведомление продавца"
status: todo
gate: G2
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["BACK", "FRONT"]
depends_on: ["5.1.2", "4.4.1"]
uc: ["O1", "L2"]
prototype: "Десктоп - Кабинет.dc.html"
screens: ["account"]
issue: null
sync_state: drifted
escalations: []
---

# 5.1.3. Решения модерации и уведомление продавца

## Цель
Продавец видит решение и дословную причину, может исправить.

## Что сделать
- Справочник причин (текст для продавца + внутренний комментарий)
- approve → published; return → needs_changes с причинами; reject → rejected + предложение меры (5.3.2)
- Кабинет: плашка с причиной и кнопкой «Исправить»; письмо и уведомление

## Критерии приёмки
- [ ] Причина в кабинете и в письме совпадает со справочником дословно
- [ ] Исправленное объявление попадает в очередь «Повторно»
- [ ] Каждое решение — в журнале с автором
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature: каждое решение
- Playwright UC-L2.spec.ts

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-O1, UC-L2 · docs/00-product/SPEC.md
- Макет: design/prototypes/Десктоп - Кабинет.dc.html · эталоны: design/screens/account@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
