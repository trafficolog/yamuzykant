---
id: "5.2.1"
phase: "5"
epic: "5.2"
title: "Жалобы"
status: todo
gate: G2
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["BACK", "FRONT"]
depends_on: ["3.1.5", "4.1.2"]
uc: ["D4"]
prototype: "Десктоп - Лот.dc.html"
screens: ["lot"]
issue: null
sync_state: drifted
escalations: []
---

# 5.2.1. Жалобы

## Цель
Пользователь сообщает о мошенничестве или нарушении.

## Что сделать
- `ComplaintDialog`: объект (объявление, пользователь, сообщение), причина из справочника, комментарий
- complaints → очередь обращений; ≥ 3 жалобы от разных пользователей за 24 ч скрывают объявление до решения
- Защита от злоупотреблений: 10 жалоб/сутки

## Критерии приёмки
- [ ] Пожаловаться на себя нельзя
- [ ] Автоскрытие срабатывает на 3-й жалобе и пишет журнал
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature: автоскрытие, лимит
- Playwright UC-D4.spec.ts

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-D4 · docs/00-product/SPEC.md
- Макет: design/prototypes/Десктоп - Лот.dc.html · эталоны: design/screens/lot@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
