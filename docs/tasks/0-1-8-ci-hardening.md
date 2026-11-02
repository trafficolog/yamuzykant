---
id: "0.1.8"
phase: "0"
epic: "0.1"
title: "CI и docs-ops: укрепление после ревью"
status: todo
gate: G1
risk: medium
model_impl: sonnet
model_review: opus
roles: ["DEVOPS", "SEC"]
depends_on: ["0.1.3", "0.2.1"]
uc: []
prototype: ""
screens: []
issue: 72
sync_state: drifted
escalations: []
---

# 0.1.8. CI и docs-ops: укрепление после ревью

## Цель
Неблокирующие замечания ревью PR #67 и #69 закрыты до появления `app/Domain` (1.1.1, 2.1.1), чтобы пороги и проверки не давали ложного зелёного.

## Что сделать
- `.github/scripts/coverage-gate.mjs`: брать метрики файла (`<metrics loc=…>`), а не первого класса; фикстура теста — как реальный clover PHPUnit (`<class><metrics>` + `<metrics loc=…>`)
- `ci.yml`: убрать пропуск сверки `resources/js/ds`, когда каталога нет (`design/ds` в main есть с 0.2.1)
- Закрепить сторонние actions по SHA (`shivammathur/setup-php`, `actions/*`, `webfactory/ssh-agent` в deploy/release); `actions/checkout` с `persist-credentials: false`
- `package.json`: `engines.node` `>=22.22`; `@vitest/coverage-v8` — точная версия, равная `vitest`
- `tools/docs-ops.mjs`: guard запуска CLI через `realpathSync(process.argv[1])`; `check --pr` получает файлы PR с пагинацией (`gh api --paginate repos/{repo}/pulls/{n}/files`), а не `gh pr view --json files` (лимит 100)

## Критерии приёмки
- [ ] Файл с двумя классами, один из которых без покрытия, даёт в coverage-gate покрытие файла, а не первого класса (тест)
- [ ] PR, удаляющий `resources/js/ds`, роняет job docs (пробный PR)
- [ ] Все `uses:` в workflows закреплены 40-символьным SHA (тест-скрипт в job docs)
- [ ] `docs-ops check --pr` видит `resources/js/ds` в PR из 150 файлов (тест с подменой gh)
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- `node --test` для coverage-gate и проверки SHA в workflows
- Vitest/node-тест на `checkDsPr` с пагинацией

## Не делать
- Менять состав jobs и пороги покрытия

## Ссылки
- PR #67 (комментарий ревьюера, п. 1, 2, 4–6), PR #69 (п. 1, 2) · docs/02-process/CI-CD.md
