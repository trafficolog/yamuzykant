---
id: "4.1.1"
phase: "4"
epic: "4.1"
title: "Сообщения: домен и realtime"
status: done
gate: G1
risk: high
model_impl: opus
model_review: opus
roles: ["BACK", "DB", "SEC"]
depends_on: ["2.1.1", "1.1.1"]
uc: ["D1"]
prototype: ""
screens: []
issue: 33
sync_state: aligned
escalations: []
---

# 4.1.1. Сообщения: домен и realtime

## Цель
Покупатель и продавец переписываются по объявлению; сообщения приходят без перезагрузки.

## Что сделать
- conversations (listing_id, buyer_id, seller_id, unique), messages (body, kind: text|system|offer, read_at)
- Reverb: каналы `private-conversation.{id}`, `private-user.{id}`; авторизация — Policy
- События MessageSent, ConversationRead; счётчик непрочитанных в shared props
- Обезличивание при удалении аккаунта (BR-09)

## Критерии приёмки
- [ ] Третье лицо не может подписаться на чужой канал (403)
- [ ] Сообщение доходит до второй вкладки ≤ 2 с
- [ ] Продавец не может начать чат с самим собой
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature: авторизация каналов, создание чата, непрочитанные
- Playwright: два контекста браузера, доставка сообщения

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-D1 · docs/00-product/SPEC.md

