---
id: "3.1.6"
phase: "3"
epic: "3.1"
title: "Страница продавца"
status: done
gate: G1
risk: low
model_impl: haiku
model_review: sonnet
roles: ["FRONT", "BACK"]
depends_on: ["3.1.5"]
uc: ["V2"]
prototype: "Десктоп - Продавец.dc.html"
screens: ["seller"]
issue: 31
sync_state: aligned
escalations: []
---

# 3.1.6. Страница продавца

## Цель
Покупатель видит, кто продаёт, и его другие объявления.

## Что сделать
- Шапка продавца: имя, «на ЯМузыканте с …», город, число продаж, время ответа
- Вкладки: в продаже, продано (без цен)
- Кнопка «Пожаловаться» (по 5.2.1)

## Критерии приёмки
- [ ] Страница в пороге эталона `seller`
- [ ] Заблокированный продавец → 404
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Playwright visual: seller
- Playwright UC-V2.spec.ts

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-V2 · docs/00-product/SPEC.md
- Макет: design/prototypes/Десктоп - Продавец.dc.html · эталоны: design/screens/seller@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
