---
id: "4.4.2"
phase: "4"
epic: "4.4"
title: "Центр уведомлений в шапке"
status: todo
gate: G2
risk: low
model_impl: haiku
model_review: sonnet
roles: ["FRONT", "BACK"]
depends_on: ["4.4.1", "4.1.1"]
uc: ["N1"]
prototype: "Шапка.dc.html"
screens: ["header"]
issue: 41
sync_state: drifted
escalations: []
---

# 4.4.2. Центр уведомлений в шапке

## Цель
Уведомления на сайте: иконка с счётчиком и список.

## Что сделать
- Laravel notifications (database + broadcast)
- Выпадающий список в шапке: последние 20, «Прочитать все», ссылка на объект

## Критерии приёмки
- [ ] Новое уведомление увеличивает счётчик без перезагрузки
- [ ] Клик ведёт к объекту и отмечает прочитанным
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature
- Playwright: счётчик в реальном времени

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-N1 · docs/00-product/SPEC.md
- Макет: design/prototypes/Шапка.dc.html · эталоны: design/screens/header@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
