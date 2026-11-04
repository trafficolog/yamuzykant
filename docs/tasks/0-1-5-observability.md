---
id: "0.1.5"
phase: "0"
epic: "0.1"
title: "Логи, ошибки, health"
status: in_progress
gate: G1
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["DEVOPS", "BACK"]
depends_on: ["0.1.4"]
uc: []
prototype: ""
screens: []
issue: 5
sync_state: drifted
escalations: []
---

# 0.1.5. Логи, ошибки, health

## Цель
Ошибки и медленные места видны с первого дня.

## Что сделать
- Sentry для PHP и JS (DSN из env), release = git sha
- Логи в JSON с `request_id`; e-mail, коды входа, серийный номер маскируются процессором Monolog
- `/health` расширить: БД, Redis, Meilisearch, очередь (возраст старейшей задачи)
- Horizon dashboard только для сотрудников

## Критерии приёмки
- [ ] Исключение на stage видно в Sentry с release и request_id
- [ ] В логах нет e-mail и кода входа в открытом виде (тест)
- [ ] `/health` отдаёт 503, если БД недоступна
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest: процессор маскирования
- Pest: /health при недоступной БД (подмена соединения)

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: — · docs/00-product/SPEC.md

