---
id: "4.2.2"
phase: "4"
epic: "4.2"
title: "Предложение цены: окно и карточка"
status: todo
gate: G2
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["FRONT"]
depends_on: ["4.2.1", "4.1.2"]
uc: ["D2", "D3"]
prototype: "Десктоп - Сообщения.dc.html"
screens: ["messages"]
issue: null
sync_state: drifted
escalations: []
---

# 4.2.2. Предложение цены: окно и карточка

## Цель
Покупатель предлагает цену, продавец отвечает — в чате.

## Что сделать
- `OfferComposer` (окно): сумма, быстрые −5/−10/−15 %, комментарий, предупреждение < 70 %
- `OfferCard` в ленте: статусы waiting, countered, accepted, declined, expired; действия продавца
- Кнопка «Предложить цену» на лоте — вход → чат → окно

## Критерии приёмки
- [ ] Состояния карточки соответствуют макету
- [ ] Принятие у продавца меняет карточку у покупателя без перезагрузки
- [ ] Окно доступно с клавиатуры, сумма — `inputmode="numeric"`
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Playwright UC-D2.spec.ts, UC-D3.spec.ts (два контекста)
- Vitest: OfferComposer расчёт скидок

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-D2, UC-D3 · docs/00-product/SPEC.md
- Макет: design/prototypes/Десктоп - Сообщения.dc.html · эталоны: design/screens/messages@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
