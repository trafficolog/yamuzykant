---
id: "6.4.2"
phase: "6"
epic: "6.4"
title: "Нагрузочное тестирование"
status: todo
gate: G3
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["DEVOPS", "BACK"]
depends_on: ["6.4.1", "6.2.2"]
uc: []
prototype: ""
screens: []
issue: null
sync_state: drifted
escalations: []
---

# 6.4.2. Нагрузочное тестирование

## Цель
Площадка выдерживает целевую нагрузку × 3.

## Что сделать
- k6-сценарии: главная, Барахолка с фильтрами, лот, отправка сообщения
- Прогон на stage с сидом 100 тыс. объявлений; целевая нагрузка — уточнить (50 RPS → 150)

## Критерии приёмки
- [ ] 5xx < 0,1 %, p95 ≤ 500 мс на 150 RPS
- [ ] Узкие места и исправления — в отчёте
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Отчёт k6 в PR

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: — · docs/00-product/SPEC.md

