# CI/CD на GitHub

## 1. Workflows

| Файл | Когда | Что делает |
|---|---|---|
| `.github/workflows/ci.yml` | каждый PR и push в `main` | jobs `docs`, `php`, `js`, `e2e` — обязательные проверки |
| `.github/workflows/deploy.yml` | зелёный CI на push в `main` этого репозитория (`workflow_run`: `event == push`, `head_branch == main`, `head_repository == github.repository`) | сборка и выкатка на `stage`; PR из форка и другие ветки пропускаются |
| `.github/workflows/release.yml` | тег `v*`; ручной запуск `workflow_dispatch` из `main` с параметром `tag` | тег — сборка и GitHub Release без выкатки, только если коммит тега в `main` (тег с дефисом — pre-release); ручной запуск — выкатка на `production` SHA тега, проверенного job `authorize`: только `vX.Y.Z` с X ≥ 1 и коммитом в `main`, `github.actor` и `github.triggering_actor` из `.github/production-deployers.txt` |

Каркас приложения в `main` с задачи 0.1.1, поэтому все четыре job работают на каждом PR. `deploy.yml` пропускает выкатку, пока нет `deploy/deploy.sh`. Защиты `main` нет (бесплатный тариф, принятый риск в `docs/operations/gates/G0.md`): правило «мерж только при зелёных docs, php, js, e2e и `REVIEW: approve`» соблюдает оркестратор.

Права workflow — явный `permissions: contents: read`; `contents: write` — только у job `release`. Условия `if`, `needs`, `permissions`, триггеры и защиту от внедрения выражений в `run` проверяет `.github/scripts/workflow-guards.test.mjs` в job `docs`.

Сторонние actions закреплены 40-символьным SHA с комментарием версии; обновление — отдельным PR, где для каждого SHA показана сверка с тегом официального репозитория (аннотированный тег — до коммита). У всех `actions/checkout` `persist-credentials: false`.

## 2. Состав CI

- **docs:** `node --test .github/scripts/coverage-gate.test.mjs .github/scripts/workflow-guards.test.mjs .github/scripts/workflow-pins.test.mjs` (порог покрытия по метрикам файла; защита deploy.yml и release.yml; закрепление `uses:` по SHA и `persist-credentials: false`), затем `node --test tools/lint-copy.test.mjs tools/copy-dictionary.test.mjs`, `node tools/docs-ops.mjs check` (структура карточек, зависимости, гейты), `node tools/lint-copy.mjs --styles`, сверка `resources/js/ds` с выводом `node tools/ds-sync.mjs` без пропуска (ручная правка или удаление копии ДС роняет job). Оркестратор перед мержем запускает `docs-ops check --pr N` (файлы PR — через `gh api --paginate`): PR, который меняет `resources/js/ds`, проходит только с заголовком `chore(ds): sync`.
- **php:** PHP 8.3 (`composer.json` → `config.platform.php = 8.3.0`), сервисы PostgreSQL 16, Redis 7, Meilisearch → `composer install` → `pint --test` → `phpstan analyse` (Larastan 8) → `pest --coverage --min=75` (+ `app/Domain` ≥ 90 % через `.github/scripts/coverage-gate.mjs`). Pest в CI работает на PostgreSQL, локально — на sqlite.
- **js:** Node 22 (`engines.node` = `>=22.22`: jsdom и undici) → `npm ci` → `eslint` → `tsc --noEmit` → `vitest run --coverage` → `vite build && vite build --ssr`.
- **e2e:** PHP + Node + сервисы → миграции и сиды → `php artisan serve` + SSR + Reverb + queue worker → `playwright test`: UC, visual, a11y, copy. Артефакты: HTML-отчёт, diff-изображения визуальных тестов.
- **Кэш:** composer, npm, браузеры Playwright.
- **Конкурентность:** `concurrency: ci-${{ github.ref }}`, отмена устаревших запусков на PR.

## 3. Ветки и PR

- `main` — всегда готова к выкатке на stage. Функции вне гейта скрыты флагами Pennant.
- Ветки задач: `task/N.M.K-slug`; исправления CI: `fix/ci-...`; синхронизация ДС: `chore/ds-sync-YYYYMMDD`.
- Мерж — только squash, сообщение = заголовок PR `feat(N.M.K): …`.
- Шаблон PR — `.github/pull_request_template.md`; issue-шаблон задачи — `.github/ISSUE_TEMPLATE/task.yml`.

## 4. Защита `main`

```bash
gh api -X PUT repos/{owner}/{repo}/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f required_status_checks.strict=true \
  -f 'required_status_checks.contexts[]=docs' -f 'required_status_checks.contexts[]=php' \
  -f 'required_status_checks.contexts[]=js' -f 'required_status_checks.contexts[]=e2e' \
  -F enforce_admins=false \
  -F required_pull_request_reviews.required_approving_review_count=1 \
  -F required_linear_history=true -F allow_force_pushes=false -F allow_deletions=false \
  -F restrictions=null
```
Если `gh api` с вложенными полями не проходит, оркестратор передаёт JSON через `--input` (пример в `tools/gh-sync.mjs --protection`).

Одобрение PR ставит ревьюер-агент от имени бота или OWNER. Если у агентов один токен с исполнителем, `required_approving_review_count` = 0, а вердикт ревьюера фиксируется комментарием `REVIEW: approve` и проверяется job `docs` (`docs-ops check --pr`). Выбор — на этапе 0, записывается в `ORCHESTRATOR.md`.

## 5. Окружения и секреты

| Окружение | Защита | Секреты |
|---|---|---|
| `stage` | без подтверждения; правило окружения — выкатка только из ветки `main` | `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `APP_KEY`, `DB_PASSWORD`, `MEILISEARCH_KEY`, `REVERB_APP_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `MAIL_PASSWORD`, `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`, `SENTRY_DSN` |
| `production` | правило окружения — выкатка только из ветки `main`; выкатка только ручным запуском `release.yml` самим OWNER (агенты не запускают); список — `.github/production-deployers.txt` (меняется PR с подтверждением OWNER; защиты `main` нет, поэтому это держится на правилах оркестратора); после перехода на Pro — ещё обязательный ревьюер OWNER | те же, свои значения |

CI использует только тестовые значения из `ci.yml`; реальные секреты в CI не нужны.

## 6. Выкатка

Скрипт выкатки — `deploy/deploy.sh` (создаёт задача 0.1.4). По умолчанию — zero-downtime через Deployer или Envoy: релизная папка, `composer install --no-dev`, `npm ci && npm run build`, `php artisan migrate --force`, `config:cache`, `route:cache`, `horizon:terminate`, `reverb:restart`, SSR-процесс через Supervisor, переключение симлинка, проверка `/health`. Откат — переключение на предыдущий релиз; миграции совместимы на одну версию назад (expand → migrate → contract).

Production выкатывается поэтапно: флаг `r1_public` в Pennant для 10 % → 50 % → 100 % посетителей.

Выкатка production: `gh workflow run release.yml --ref main -f tag=vX.Y.Z` (запускает только OWNER). Версии `v0.*` в production не выкатываются.
