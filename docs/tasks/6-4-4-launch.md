---
id: "6.4.4"
phase: "6"
epic: "6.4"
title: "Запуск R1 и 48 часов наблюдения"
status: todo
gate: G3
risk: high
model_impl: opus
model_review: opus
roles: ["DEVOPS", "QA"]
depends_on: ["6.4.1", "6.4.2", "6.4.3", "6.3.1", "6.3.2", "6.2.3", "6.1.2"]
uc: []
prototype: ""
screens: []
issue: 64
sync_state: drifted
escalations: []
---

# 6.4.4. Запуск R1 и 48 часов наблюдения

## Цель
Публичный запуск по RELEASE-GATES.md §G3.

## Что сделать
- Финальный регресс: все UC-*.spec.ts, visual, a11y, copy на production-подобном стенде
- Тег v1.0.0, выкатка, поэтапное включение
- 48 ч наблюдения: метрики, ошибки, обращения; итоговый docs/operations/gates/G3.md

## Критерии приёмки
- [ ] Все пункты чек-листа G3 с доказательствами
- [ ] OWNER подписал G3
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Полный прогон e2e на production после выкатки (smoke без записи)

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: — · docs/00-product/SPEC.md

