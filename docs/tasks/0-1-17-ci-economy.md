---
id: "0.1.17"
phase: "0"
epic: "0.1"
title: "Экономия минут CI: docs-only без тяжёлых джобов, e2e перед мержем"
status: done
gate: G1
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["DEVOPS"]
depends_on: []
uc: []
issue: 142
sync_state: aligned
escalations: []
---

# 0.1.17. Экономия минут CI

## Цель
Репозиторий приватный, минуты Actions платные; за 08.11.2026 — 95 прогонов, лимит расходов исчерпан. Сократить расход в разы, не ослабляя правило мержа (решение OWNER 08.11.2026).

## Что сделать
- Джоб `changes` (без сторонних actions, через `git diff` от базы PR или `github.event.before`): выход `code` = есть изменения вне `docs/**` и `*.md` в корне
- `php`, `js`, `e2e` пропускаются, если `code != 'true'` (коммиты статусов в `main`, docs-only PR); `docs` идёт всегда
- `e2e` — на push в `main` при изменениях кода и по `workflow_dispatch` (оркестратор запускает перед мержем: `gh workflow run ci.yml --ref <ветка>`); на событиях `pull_request` не идёт. Метки на CI не влияют (ревью PR #146: событие `labeled` перекрывало SUCCESS на SKIPPED)
- Для PR — `git diff HEAD^1 HEAD` на merge-ref с `fetch-depth: 2`
- `deploy.yml` не меняется; проверить, что он по-прежнему стартует только после успешного CI на `main`
- Обновить `docs/02-process/CI-CD.md` (триггеры, dispatch перед мержем, пропуск для docs-only: php/js/e2e = SKIPPED допустимы только при `changes` = SUCCESS и `code=false`)
- Тесты guard-скриптов (`.github/scripts/*.test.mjs`) зелёные; добавить проверки новых условий, если guard-тесты разбирают ci.yml

## Критерии приёмки
- [ ] Docs-only push в `main` запускает только `docs`
- [ ] Push в PR — `docs`, `php`, `js`; `workflow_dispatch` на ветку — плюс `e2e`
- [ ] Метки не запускают CI и не меняют статусы проверок
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- node --test для guard-скриптов: условия `changes`/dispatch в ci.yml

## Не делать
- Не ослаблять пороги и состав проверок; не трогать release.yml, provision.yml

## Ссылки
- docs/02-process/CI-CD.md · ORCHESTRATOR.md
