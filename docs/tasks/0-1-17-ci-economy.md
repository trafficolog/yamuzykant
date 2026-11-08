---
id: "0.1.17"
phase: "0"
epic: "0.1"
title: "Экономия минут CI: docs-only без тяжёлых джобов, e2e по метке ready"
status: in_progress
gate: G1
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["DEVOPS"]
depends_on: []
uc: []
sync_state: aligned
escalations: []
---

# 0.1.17. Экономия минут CI

## Цель
Репозиторий приватный, минуты Actions платные; за 08.11.2026 — 95 прогонов, лимит расходов исчерпан. Сократить расход в разы, не ослабляя правило мержа (решение OWNER 08.11.2026).

## Что сделать
- Джоб `changes` (без сторонних actions, через `git diff` от базы PR или `github.event.before`): выход `code` = есть изменения вне `docs/**` и `*.md` в корне
- `php`, `js`, `e2e` пропускаются, если `code != 'true'` (коммиты статусов в `main`, docs-only PR); `docs` идёт всегда
- `e2e` на PR — только при метке `ready` на PR; на push в `main` — при изменениях кода, как раньше
- `pull_request.types`: `opened, synchronize, reopened, labeled`; событие `labeled` с другой меткой не запускает джобы и не отменяет текущий прогон (отдельная группа concurrency)
- `deploy.yml` не меняется; проверить, что он по-прежнему стартует только после успешного CI на `main`
- Обновить `docs/02-process/CI-CD.md` (триггеры, метка `ready`, пропуск для docs-only)
- Тесты guard-скриптов (`.github/scripts/*.test.mjs`) зелёные; добавить проверки новых условий, если guard-тесты разбирают ci.yml

## Критерии приёмки
- [ ] Docs-only push в `main` запускает только `docs`
- [ ] Push в PR без метки `ready` — `docs`, `php`, `js`; с меткой — плюс `e2e`
- [ ] Навешивание посторонней метки не запускает и не отменяет CI
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- node --test для guard-скриптов: условия `changes`/`ready` в ci.yml

## Не делать
- Не ослаблять пороги и состав проверок; не трогать release.yml, provision.yml

## Ссылки
- docs/02-process/CI-CD.md · ORCHESTRATOR.md
