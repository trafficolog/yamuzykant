# CI/CD на GitHub

## 1. Workflows

| Файл | Когда | Что делает |
|---|---|---|
| `.github/workflows/ci.yml` | PR (`opened`, `synchronize`, `reopened`, `labeled`) и push в `main` | jobs `changes`, `docs`, `php`, `js`, `e2e`; `docs`, `php`, `js`, `e2e` — обязательные проверки; пропуск и метка `ready` — §2 |
| `.github/workflows/deploy.yml` | зелёный CI на push в `main` этого репозитория (`workflow_run`: `event == push`, `head_branch == main`, `head_repository == github.repository`) | `deploy/deploy.sh stage "$SHA"` по SSH-ключу (SHA — `head_sha` проверенного запуска CI в `checkout.ref` и `env.SHA`), затем `/health`; пока переменная окружения `STAGE_DEPLOY_LIVE` ≠ `true` (до 0.1.12) — dry-run без SSH; PR из форка и другие ветки пропускаются |
| `.github/workflows/provision.yml` | ручной запуск `workflow_dispatch` из `main` (запускает OWNER) | окружение `stage`: `provision` — `deploy/provision.sh remote` (идемпотентная подготовка сервера, очередь `deploy-stage`), `rollback` — `deploy/deploy.sh rollback stage` (своя группа `stage-rollback` без отмены: мерж не отменяет ожидающий откат; на сервере выкатка ждёт откат по `flock`) |
| `.github/workflows/release.yml` | тег `v*`; ручной запуск `workflow_dispatch` из `main` с параметром `tag` | тег — сборка и GitHub Release без выкатки, только если коммит тега в `main` (тег с дефисом — pre-release); ручной запуск — выкатка на `production` SHA тега, проверенного job `authorize`: только `vX.Y.Z` с X ≥ 1 и коммитом в `main`, `github.actor` и `github.triggering_actor` из `.github/production-deployers.txt` |

Каркас приложения в `main` с задачи 0.1.1; при изменениях кода `docs`, `php`, `js` работают на каждом PR, `e2e` — по метке `ready` (§2). Выкатка stage идёт в режиме dry-run, пока OWNER не задаст `STAGE_DEPLOY_LIVE = true` (после 0.1.12). Защиты `main` нет (бесплатный тариф, принятый риск в `docs/operations/gates/G0.md`): правило «мерж только при зелёных docs, php, js, e2e и `REVIEW: approve`» соблюдает оркестратор.

Права workflow — явный `permissions: contents: read`; `contents: write` — только у job `release`. Условия `if`, `needs`, `permissions`, триггеры и защиту от внедрения выражений в `run` проверяет `.github/scripts/workflow-guards.test.mjs` в job `docs`.

Сторонние actions закреплены 40-символьным SHA с комментарием версии; обновление — отдельным PR, где для каждого SHA показана сверка с тегом официального репозитория (аннотированный тег — до коммита). У всех `actions/checkout` `persist-credentials: false`.

## 2. Состав CI

- **changes:** без сторонних actions: `git diff --name-only` от базы PR (`pull_request.base.sha`) или `github.event.before` на push; выход `code=true`, если изменён любой файл вне `docs/**` и `*.md` в корне. Нет базы (новая ветка, нулевой `before`, коммит не найден) — `code=true`. Изменения `.github/**` и `tools/**` — это код.
- **Экономия минут (0.1.17):** `docs` идёт всегда. `php` и `js` — только при `code=true`. `e2e`: на push в `main` — при `code=true`; на PR — при `code=true` и метке `ready` на PR (метку ставит оркестратор, когда PR готов к мержу; создана командой `gh label create ready`). Так коммиты статусов в `main` и docs-only PR запускают только `docs`, а полный e2e платится один раз на PR. Событие `labeled` с меткой не `ready` не запускает ни одного job и не отменяет идущий прогон (своя группа concurrency с `run_id`); метка `ready` запускает полный прогон, в том числе `e2e`. Пропущенный job (`skipped`) не делает прогон красным, поэтому `deploy.yml` (`workflow_run.conclusion == success`) по-прежнему стартует после зелёного CI на `main`; docs-only коммит в `main` выкатывает ту же версию кода.
- **docs:** `node --test .github/scripts/coverage-gate.test.mjs .github/scripts/workflow-guards.test.mjs .github/scripts/workflow-pins.test.mjs .github/scripts/deploy-scripts.test.mjs` (порог покрытия по метрикам файла; защита deploy.yml, release.yml, provision.yml; закрепление `uses:` по SHA и `persist-credentials: false`; скрипты выкатки: shellcheck `deploy/*.sh`, bash-тесты deploy.sh и provision.sh в песочнице, настоящий `nginx:1.27` в Docker — `/health` и `/up` без пароля, остальное 401), затем `node --test tools/lint-copy.test.mjs tools/copy-dictionary.test.mjs`, `node tools/docs-ops.mjs check` (структура карточек, зависимости, гейты), `node tools/lint-copy.mjs --styles`, сверка `resources/js/ds` с выводом `node tools/ds-sync.mjs` без пропуска (ручная правка или удаление копии ДС роняет job). Оркестратор перед мержем запускает `docs-ops check --pr N` (файлы PR — через `gh api --paginate`): PR, который меняет `resources/js/ds`, проходит только с заголовком `chore(ds): sync`.
- **php:** PHP 8.3 (`composer.json` → `config.platform.php = 8.3.0`), сервисы PostgreSQL 16, Redis 7, Meilisearch → `composer install` → `pint --test` → `phpstan analyse` (Larastan 8) → `pest --coverage --min=75` (+ `app/Domain` ≥ 90 % через `.github/scripts/coverage-gate.mjs`). Pest в CI работает на PostgreSQL, локально — на sqlite.
- **js:** Node 22 (`engines.node` = `>=22.22`: jsdom и undici) → `npm ci` → `eslint` → `tsc --noEmit` → `vitest run --coverage` → `vite build && vite build --ssr`.
- **e2e:** PHP + Node + сервисы → миграции и сиды → `php artisan serve` + SSR + Reverb + queue worker → `playwright test`: UC, visual, a11y, copy. Артефакты: HTML-отчёт, diff-изображения визуальных тестов.
- **Кэш:** composer, npm, браузеры Playwright.
- **Конкурентность:** группа `ci-<ref>`, отмена устаревших запусков на PR; запуск от посторонней метки — в отдельной группе `ci-<ref>-label-<run_id>`.

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
| `stage` | без подтверждения; правило окружения — выкатка только из ветки `main` | `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `APP_KEY`, `DB_PASSWORD`, `MEILISEARCH_KEY`, `REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MAILPIT_UI_USER`, `MAILPIT_UI_PASSWORD`, `STAGE_BASIC_AUTH_USER`, `STAGE_BASIC_AUTH_PASSWORD`, `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`, `SENTRY_DSN`; переменные — `STAGE_URL`, `CERTBOT_EMAIL`, `STAGE_DEPLOY_LIVE`, `PROVISION_USER` (по умолчанию `root`), `DEPLOY_PORT` (по умолчанию 22) |
| `production` | правило окружения — выкатка только из ветки `main`; выкатка только ручным запуском `release.yml` самим OWNER (агенты не запускают); список — `.github/production-deployers.txt` (меняется PR с подтверждением OWNER; защиты `main` нет, поэтому это держится на правилах оркестратора); после перехода на Pro — ещё обязательный ревьюер OWNER | те же, свои значения |

`.env` на сервере собирает `deploy.sh` из этих значений при каждой выкатке (`shared/.env`, 0600); SSH — только с `StrictHostKeyChecking yes` и `known_hosts` из `DEPLOY_KNOWN_HOSTS`. CI использует только тестовые значения из `ci.yml`; реальные секреты в CI не нужны.

## 6. Выкатка

Скрипт выкатки — `deploy/deploy.sh` (задача 0.1.4), подготовка сервера — `deploy/provision.sh`. Сервер stage — VPS Ubuntu LTS без прокси и CDN: Nginx (HTTPS certbot, basic-auth), PHP 8.3-FPM, PostgreSQL 16, Redis 7, Supervisor (очередь `high,default` — Horizon или `queue:work`, Reverb, SSR, планировщик), Meilisearch, Mailpit и MinIO в Docker на `127.0.0.1`. Выкатка: архив проверенного SHA → `releases/<UTC>-<sha12>` → `composer install --no-dev`, `npm ci && npm run build && npm run build:ssr`, `php artisan migrate --force`, `config:cache`, `route:cache`, `view:cache`, Scout (`scout:sync-index-settings`, `scout:import`, если установлен) → атомарное переключение симлинка `current` → `reload php-fpm`, `horizon:terminate` (или `queue:restart`), `reverb:restart`, перезапуск SSR → проверка `/health`, процессов Supervisor, Horizon, SSR; не прошла — автооткат. Падение до переключения (в том числе миграции) оставляет прежний релиз. Не прошёл перезапуск или проверка — автооткат, релиз помечается `.deploy-failed` и не считается рабочим. Откат — `deploy/deploy.sh rollback` на сервере или `provision.yml` → `rollback` (≤ 1 мин, без сборки, мимо помеченных релизов); миграции совместимы на одну версию назад (expand → migrate → contract). `shared/.env` общий и перезаписывается при выкатке; откат опирается на кэш конфигурации релиза (`config:cache`). Журналы программ Supervisor — `/var/log/ymuzykant/` (root), журналы Laravel — `shared/storage/logs`.

Production выкатывается поэтапно: флаг `r1_public` в Pennant для 10 % → 50 % → 100 % посетителей.

Выкатка production: `gh workflow run release.yml --ref main -f tag=vX.Y.Z` (запускает только OWNER). Версии `v0.*` в production не выкатываются.
