---
id: "6.3.1"
phase: "6"
epic: "6.3"
title: "Модель угроз R1"
status: todo
gate: G3
risk: high
model_impl: opus
model_review: opus
roles: ["SEC"]
depends_on: ["5.3.4", "4.2.1", "2.1.2"]
uc: []
prototype: ""
screens: []
issue: null
sync_state: drifted
escalations: []
---

# 6.3.1. Модель угроз R1

## Цель
Угрозы всех поверхностей R1 найдены и закрыты или приняты OWNER.

## Что сделать
- STRIDE по поверхностям: вход, загрузки, чат и каналы, предложения, консоль, поиск, письма
- `docs/operations/security/STRIDE-R1.md`: угроза → мера → статус → доказательство
- Задачи fix на каждую незакрытую угрозу high

## Критерии приёмки
- [ ] Все угрозы high закрыты или приняты OWNER письменно
- [ ] CSP, заголовки безопасности, cookie-флаги проверены тестом
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature: заголовки безопасности
- Тесты по найденным угрозам — в задачах fix

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: — · docs/00-product/SPEC.md

