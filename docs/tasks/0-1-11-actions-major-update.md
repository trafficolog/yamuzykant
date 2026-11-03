---
id: "0.1.11"
phase: "0"
epic: "0.1"
title: "GitHub Actions: переход на актуальные мажорные версии"
status: todo
gate: G2
risk: low
model_impl: haiku
model_review: sonnet
roles: ["DEVOPS"]
depends_on: ["0.1.8"]
uc: []
prototype: ""
screens: []
issue: 93
sync_state: drifted
escalations: []
---

# 0.1.11. GitHub Actions: переход на актуальные мажорные версии

## Цель
CI не зависит от устаревшего Node 20 внутри actions v4 (предупреждение CI, ревью PR #91).

## Что сделать
- Обновить `actions/checkout`, `actions/setup-node`, `actions/cache`, `actions/upload-artifact`, `actions/download-artifact`, `shivammathur/setup-php`, `webfactory/ssh-agent` до актуальных мажорных версий; закрепить 40-символьным SHA с комментарием версии
- Сверка SHA с тегом официального репозитория (аннотированные теги — до коммита) — описать в PR для каждой пары
- Фикстуры `coverage-gate.test.mjs` с `<trait>` и самозакрывающимся `<class/>`; удаление временного каталога с junction в `tests/js/ds/docs-ops.test.ts`

## Критерии приёмки
- [ ] В логах CI нет предупреждения об устаревшем Node 20
- [ ] workflow-pins и workflow-guards зелёные, поведение deploy/release не изменилось
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Существующие workflow-pins.test.mjs и workflow-guards.test.mjs; новые фикстуры coverage-gate

## Не делать
- Менять условия и права deploy/release

## Ссылки
- PR #91 (комментарий ревьюера, п. 1, 2, 4)
