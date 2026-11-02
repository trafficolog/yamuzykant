---
id: "4.2.1"
phase: "4"
epic: "4.2"
title: "Предложение цены: домен"
status: todo
gate: G2
risk: high
model_impl: opus
model_review: opus
roles: ["BACK", "DB"]
depends_on: ["4.1.1"]
uc: ["D2", "D3"]
prototype: ""
screens: []
issue: 36
sync_state: drifted
escalations: []
---

# 4.2.1. Предложение цены: домен

## Цель
Предложения по SPEC §6.2 и BR-05.

## Что сделать
- offers (conversation_id, from_user_id, amount, status, expires_at)
- `OfferStateMachine`; правила: ≤ цены, одно активное на пару, только если «Готов к торгу»
- Принятие пишет системное сообщение «Цена согласована: N ₽»
- Job `ExpireOffers` каждые 5 мин; отмена при снятии объявления

- Письмо продавцу о новом предложении и покупателю об ответе — по шаблону 4.4.1

## Критерии приёмки
- [ ] Каждый переход §6.2 работает, остальные — исключение
- [ ] Сумма ≥ цены → 422 с текстом «Это не ниже цены — просто напишите продавцу»
- [ ] Второе активное предложение → 422
- [ ] Истечение через 48 ч (значение в конфиге)
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest unit: все переходы
- Pest feature: правила BR-05
- Pest: ExpireOffers с travel()

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-D2, UC-D3 · docs/00-product/SPEC.md

