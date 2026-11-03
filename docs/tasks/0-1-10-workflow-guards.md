---
id: "0.1.10"
phase: "0"
epic: "0.1"
title: "Защита release.yml и deploy.yml без branch protection"
status: done
gate: G1
risk: high
model_impl: opus
model_review: opus
roles: ["DEVOPS", "SEC"]
depends_on: ["0.1.3"]
uc: []
prototype: ""
screens: []
issue: 81
sync_state: aligned
escalations: []
---

# 0.1.10. Защита release.yml и deploy.yml без branch protection

## Цель
Тег или чужой PR не может выкатить production или stage без OWNER, пока на бесплатном тарифе нет правил окружений (аудит G0, риски R1 и R2).

## Что сделать
- `release.yml`: выкатка production — только `workflow_dispatch` с ручным подтверждением (входной параметр-тег + проверка, что запускает OWNER: `github.actor` из списка в конфиге) либо только для `v1.*`; для `v0.*` — только сборка и GitHub Release без деплоя. Release создаётся, даже если деплоя нет
- `deploy.yml`: запускать только при `github.event.workflow_run.event == 'push'`, `head_branch == 'main'` и `head_repository.full_name == github.repository`; без этого — пропуск
- Явные `permissions` в `deploy.yml` и `release.yml` (минимум; `contents: write` — только у шага Release)
- `.gitignore`: `.env.*` (кроме `.env.example`)

## Критерии приёмки
- [ ] Тег `v0.x.0` создаёт GitHub Release и не запускает деплой (пробный тег на ветке-пробе, затем удалён)
- [ ] `workflow_run` от PR из форка или не от push в main — деплой пропущен (проверка условий тестом-скриптом в job docs)
- [ ] У каждого workflow есть явный блок `permissions`
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Скрипт-проверка YAML (node --test): условия `if` у deploy и release, наличие `permissions`

## Не делать
- Добавлять секреты и сам скрипт деплоя (это 0.1.4)

## Ссылки
- Аудит G0 (docs/operations/gates/G0.md, риски R1, R2) · docs/02-process/CI-CD.md
