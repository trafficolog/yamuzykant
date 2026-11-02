---
id: "0.3.1"
phase: "0"
epic: "0.3"
title: "GitHub: метки, вехи, задачи, защита"
status: ready
gate: G0
risk: medium
model_impl: opus
model_review: opus
roles: ["DEVOPS"]
depends_on: []
uc: []
prototype: ""
screens: []
issue: null
sync_state: drifted
escalations: []
---

# 0.3.1. GitHub: метки, вехи, задачи, защита

## Цель
Репозиторий настроен по ORCHESTRATOR.md, этап 0. Выполняет оркестратор до 0.1.1.

## Что сделать
- `node tools/gh-sync.mjs` (dry-run) → сводка OWNER → `--apply`
- Номера issue записаны в карточки
- `--protection --apply` после 0.1.3
- Окружения `stage`, `production` созданы, список секретов передан OWNER

## Критерии приёмки
- [ ] Число открытых issue = числу карточек не в статусе done
- [ ] Повторный `gh-sync --apply` ничего не создаёт
- [ ] `docs-ops check` зелёный
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- `node tools/docs-ops.mjs check` в CI

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: — · docs/00-product/SPEC.md

