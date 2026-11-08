---
id: "2.1.6"
phase: "2"
epic: "2.1"
title: "Лимит активных объявлений"
status: todo
gate: G1
risk: low
model_impl: haiku
model_review: sonnet
roles: ["BACK", "FRONT"]
depends_on: ["2.1.4"]
uc: ["L1"]
prototype: "Десктоп - Продать.dc.html"
screens: ["sell"]
issue: 25
sync_state: drifted
escalations: []
---

# 2.1.6. Лимит активных объявлений

## Цель
Частное лицо не может держать больше 10 активных объявлений (BR-06, значение в конфиге).

## Что сделать
- Активные = published + pending + needs_changes
- При превышении — состояние формы «Лимит: 10 из 10» с советом снять старое; черновик сохраняется
- (из 2.1.4, PR #136) Лимит активных применяется и к `renew` и `relist` (возврат из expired и withdrawn в активные); `resubmit` из needs_changes лимит не меняет (уже активное)

## Критерии приёмки
- [ ] 11-е объявление не публикуется, черновик остаётся
- [ ] Снятое объявление освобождает место
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest unit: подсчёт активных
- Pest feature: отказ publish сверх лимита

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-L1 · docs/00-product/SPEC.md
- Макет: design/prototypes/Десктоп - Продать.dc.html · эталоны: design/screens/sell@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
