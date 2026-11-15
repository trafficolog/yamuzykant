# CI/CD на GitHub

## 1. Workflows

| Файл | Когда | Что делает |
|---|---|---|
| `.github/workflows/ci.yml` | PR (события по умолчанию), push в `main` и ручной запуск `workflow_dispatch` | jobs `changes`, `docs`, `php`, `js`, `e2e`; `docs`, `php`, `js`, `e2e` — обязательные проверки; пропуск и ручной запуск перед мержем — §2 |
| `.github/workflows/deploy.yml` | зелёный CI на push в `main` этого репозитория (`workflow_run`: `event == push`, `head_branch == main`, `head_repository == github.repository`) | `deploy/deploy.sh stage "$SHA"` по SSH-ключу (SHA — `head_sha` проверенного запуска CI в `checkout.ref` и `env.SHA`), затем `/health`; пока переменная окружения `STAGE_DEPLOY_LIVE` ≠ `true` — dry-run без SSH; PR из форка и другие ветки пропускаются |
| `.github/workflows/provision.yml` | ручной запуск `workflow_dispatch` из `main` (запускает OWNER) | окружение `stage`: `provision` — `deploy/provision.sh remote` (идемпотентная подготовка сервера, затем вход только по ключу — §5; очередь `deploy-stage`), `rollback` — `deploy/deploy.sh rollback stage` (своя группа `stage-rollback` без отмены: мерж не отменяет ожидающий откат; на сервере выкатка ждёт откат по `flock`) |
| `.github/workflows/release.yml` | тег `v*`; ручной запуск `workflow_dispatch` из `main` с параметром `tag` | тег — сборка и GitHub Release без выкатки, только если коммит тега в `main` (тег с дефисом — pre-release); ручной запуск — выкатка на `production` SHA тега, проверенного job `authorize`: только `vX.Y.Z` с X ≥ 1 и коммитом в `main`, `github.actor` и `github.triggering_actor` из `.github/production-deployers.txt` |

Каркас приложения в `main` с задачи 0.1.1; при изменениях кода `docs`, `php`, `js` работают на каждом PR, `e2e` — только на push в `main` и по ручному запуску перед мержем (§2). Выкатка stage идёт в режиме dry-run, пока OWNER не задаст `STAGE_DEPLOY_LIVE = true` (после `provision.yml` → `provision`, порядок — §5). Защиты `main` нет (бесплатный тариф, принятый риск в `docs/operations/gates/G0.md`): правило «мерж только при зелёных docs, php, js, e2e и `REVIEW: approve`» соблюдает оркестратор.

Права workflow — явный `permissions: contents: read`; `contents: write` — только у job `release`. Условия `if`, `needs`, `permissions`, триггеры и защиту от внедрения выражений в `run` проверяет `.github/scripts/workflow-guards.test.mjs` в job `docs`.

Сторонние actions закреплены 40-символьным SHA с комментарием версии; обновление — отдельным PR, где для каждого SHA показана сверка с тегом официального репозитория (аннотированный тег — до коммита). У всех `actions/checkout` `persist-credentials: false`.

## 2. Состав CI

- **changes:** без сторонних actions. PR: `git diff --name-only HEAD^1 HEAD` на merge-ref (`fetch-depth: 2`, первый родитель — актуальная база). Push: от `github.event.before` (`fetch-depth: 0`). `workflow_dispatch` и любое отсутствие базы (новая ветка, нулевой `before`, коммит не найден) — `code=true`. Выход `code=true`, если изменён любой файл вне `docs/**` и `*.md` в корне; изменения `.github/**` и `tools/**` — это код.
- **Экономия минут (0.1.17):** `docs` идёт всегда. `php` и `js` — только при `code=true`. `e2e` — при `code=true` на push в `main` и на `workflow_dispatch`; на PR не идёт. Так коммиты статусов в `main` и docs-only PR запускают только `docs`, а полный e2e платится один раз на PR. Метки на CI не влияют. Пропущенный job (`skipped`) не делает прогон красным, поэтому `deploy.yml` (`workflow_run.conclusion == success`) по-прежнему стартует после зелёного CI на `main`; docs-only коммит в `main` выкатывает ту же версию кода.
- **Проверка перед мержем:** оркестратор подтягивает ветку PR к `main`, запускает `gh workflow run ci.yml --ref <ветка>` и ждёт зелёный прогон (check runs ставятся на тот же head SHA и видны в PR). Dispatch проверяет голову ветки, а не merge-коммит, поэтому ветка должна быть актуальной. Правило статусов: `docs`, `php`, `js`, `e2e` = SUCCESS; **`php`, `js`, `e2e` = SKIPPED допустимы только при `changes` = SUCCESS и `code=false`** (docs-only PR), иначе обязателен SUCCESS.
- **docs:** `node --test .github/scripts/coverage-gate.test.mjs .github/scripts/workflow-guards.test.mjs .github/scripts/workflow-pins.test.mjs .github/scripts/deploy-scripts.test.mjs` (порог покрытия по метрикам файла; защита deploy.yml, release.yml, provision.yml; закрепление `uses:` по SHA и `persist-credentials: false`; скрипты выкатки: shellcheck `deploy/*.sh`, bash-тесты deploy.sh и provision.sh в песочнице, настоящий `nginx:1.27` в Docker — `/health` и `/up` без пароля, остальное 401), затем `node --test tools/lint-copy.test.mjs tools/copy-dictionary.test.mjs`, `node tools/docs-ops.mjs check` (структура карточек, зависимости, гейты), `node tools/lint-copy.mjs --styles`, сверка `resources/js/ds` с выводом `node tools/ds-sync.mjs` без пропуска (ручная правка или удаление копии ДС роняет job). Оркестратор перед мержем запускает `docs-ops check --pr N` (файлы PR — через `gh api --paginate`): PR, который меняет `resources/js/ds`, проходит только с заголовком `chore(ds): sync`.
- **php:** PHP 8.3 (`composer.json` → `config.platform.php = 8.3.0`), сервисы PostgreSQL 16, Redis 7, Meilisearch → `composer install` → `pint --test` → `phpstan analyse` (Larastan 8) → `pest --coverage --min=75` (+ `app/Domain` ≥ 90 % через `.github/scripts/coverage-gate.mjs`). Pest в CI работает на PostgreSQL, локально — на sqlite.
- **js:** Node 22 (`engines.node` = `>=22.22`: jsdom и undici) → `npm ci` → `eslint` → `tsc --noEmit` → `vitest run --coverage` → `vite build && vite build --ssr`.
- **e2e:** PHP + Node + сервисы → миграции и сиды → `php artisan serve` + SSR + Reverb + queue worker → `playwright test`: UC, visual, a11y, copy. Артефакты: HTML-отчёт, diff-изображения визуальных тестов.
- **Кэш:** composer, npm, браузеры Playwright.
- **Конкурентность:** `concurrency: ci-${{ github.ref }}`, отмена устаревших запусков только на PR.

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

`.env` на сервере собирает `deploy.sh` из этих значений при каждой выкатке (`shared/.env`, 0600); SSH — только с `StrictHostKeyChecking yes` и `known_hosts` из `DEPLOY_KNOWN_HOSTS`, без `ssh-keyscan` (`deploy/lib.sh`, проверяют `workflow-guards.test.mjs` и `deploy-scripts.test.mjs`). CI использует только тестовые значения из `ci.yml`; реальные секреты в CI не нужны.

**SSH-ключ и вход на stage (задача 0.1.12).** `DEPLOY_SSH_KEY` — приватный ключ ed25519 целиком (`-----BEGIN OPENSSH PRIVATE KEY-----` … `END`); `deploy.yml` и `provision.yml` проверяют формат до `ssh-agent`, не печатая значение. `DEPLOY_KNOWN_HOSTS` — строка `адрес тип ключ` (например, вывод `ssh-keygen -F <хост>` из своего `~/.ssh/known_hosts` после входа, сверенный с отпечатком из панели VPS). `DEPLOY_USER` — не root: `provision` создаёт его, дописывает в `~/.ssh/authorized_keys` публичную часть `DEPLOY_SSH_KEY` (из `ssh-add -L` раннера) и даёт sudo только на `systemctl reload php8.3-fpm` и `supervisorctl status|restart|start ymuzykant:*`. После `apply` раннер входит пользователем деплоя по ключу (`BatchMode`, без пароля); только если вход прошёл, `provision.sh sshd` от root проверяет ключи в `authorized_keys` root и пользователя деплоя, пишет `deploy/ssh/00-ymuzykant.conf` в `/etc/ssh/sshd_config.d/` (`PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `PermitRootLogin prohibit-password`), проверяет `sshd -t` и итог `sshd -T` и перезагружает ssh; любая неудача — файл удаляется, вход по паролю остаётся. `provision` подключается от root по ключу, поэтому root — `prohibit-password`, а не `no`. Выкатка ждёт блокировку сервера `DEPLOY_LOCK_WAIT` = 900 с; `timeout-minutes` `deploy.yml` = 35 (ожидание + до 20 мин на сборку), у `provision.yml` = 40 (откат + 5 мин) — соотношение проверяет `workflow-guards.test.mjs`.

Порядок для OWNER (агенты эти workflow не запускают):
1. Секреты окружения `stage`: `DEPLOY_SSH_KEY` (приватный ключ), `DEPLOY_KNOWN_HOSTS`, `DEPLOY_HOST`, `DEPLOY_USER` (не root) и остальные из таблицы; переменные `STAGE_URL`, `CERTBOT_EMAIL`; `STAGE_DEPLOY_LIVE` пока не задавать. Публичный ключ — в `/root/.ssh/authorized_keys` (`ssh-copy-id root@<хост>`, по паролю, один раз).
2. `gh workflow run provision.yml --ref main -f command=provision` → зелёный; в журнале «Проверка входа по ключу пользователем …» и «Вход на сервер только по ключу (sshd)».
3. Проверка со своего компьютера: `ssh -o PubkeyAuthentication=no -o PreferredAuthentications=password,keyboard-interactive <DEPLOY_USER>@<хост>` и то же для `root@<хост>` → `Permission denied (publickey)`; `ssh <DEPLOY_USER>@<хост> true` по ключу — входит; `sudo -n -l` под пользователем деплоя — только правила `ymuzykant-deploy`. Вывод — в PR задачи 0.1.12.
4. Переменная окружения `stage` `STAGE_DEPLOY_LIVE = true`.
5. Выкатка: мерж в `main` или перезапуск последнего `Deploy stage` (`gh run rerun <id>`) → зелёный, шаг `/health` 200.
6. Откат: `gh workflow run provision.yml --ref main -f command=rollback` → зелёный, шаг отката ≤ 1 мин (время шага в журнале), `/health` 200.
7. Повторная выкатка (перезапуск `Deploy stage`) → зелёный, `/health` 200.

## 6. Выкатка

Скрипт выкатки — `deploy/deploy.sh` (задача 0.1.4), подготовка сервера — `deploy/provision.sh`. Сервер stage — VPS Ubuntu LTS без прокси и CDN: Nginx (HTTPS certbot, basic-auth), PHP 8.3-FPM, PostgreSQL 16, Redis 7, Supervisor (очередь `high,default` — Horizon или `queue:work`, Reverb, SSR, планировщик), Meilisearch, Mailpit и MinIO в Docker на `127.0.0.1`. Выкатка: архив проверенного SHA → `releases/<UTC>-<sha12>` → `composer install --no-dev`, `npm ci && npm run build && npm run build:ssr`, `php artisan migrate --force`, `config:cache`, `route:cache`, `view:cache`, Scout (`scout:sync-index-settings`, `scout:import`, если установлен) → атомарное переключение симлинка `current` → `reload php-fpm`, `horizon:terminate` (или `queue:restart`), `reverb:restart`, перезапуск SSR → проверка `/health`, процессов Supervisor, Horizon, SSR; не прошла — автооткат. Падение до переключения (в том числе миграции) оставляет прежний релиз. Не прошёл перезапуск или проверка — автооткат, релиз помечается `.deploy-failed` и не считается рабочим. Откат — `deploy/deploy.sh rollback` на сервере или `provision.yml` → `rollback` (≤ 1 мин, без сборки, мимо помеченных релизов); миграции совместимы на одну версию назад (expand → migrate → contract). `shared/.env` общий и перезаписывается при выкатке; откат опирается на кэш конфигурации релиза (`config:cache`). Журналы программ Supervisor — `/var/log/ymuzykant/` (root), журналы Laravel — `shared/storage/logs`.

**Reverb (задача 0.1.16).** `ymuzykant-reverb` в Supervisor запускает `php artisan reverb:start` на `127.0.0.1:8080` (`deploy/bin/worker.sh reverb`, лимит открытых файлов поднимается через `ulimit -n`; `REVERB_NOFILE`, по умолчанию 10000). Браузер подключается по `wss://<домен>/app/<REVERB_APP_KEY>` через Nginx (`location /app/`: Upgrade/Connection, `proxy_read_timeout` и `proxy_send_timeout` 120 с при ping Reverb раз в 60 с, без буферизации; HTTP API Reverb `/apps/…` наружу не проксируется, TLS — на Nginx). Выкатка перезапускает Reverb: `php artisan reverb:restart` и `supervisorctl restart ymuzykant:ymuzykant-reverb`; после переключения `verify` проверяет, что порт 8080 отвечает, и при `BROADCAST_CONNECTION=reverb` без живого Reverb откатывает релиз. `deploy.sh` пишет в `.env` `BROADCAST_CONNECTION=reverb`, `REVERB_*` (`REVERB_HOST/PORT/SCHEME` — локально, `REVERB_PUBLIC_HOST` — домен окружения, `443`, `https`, `REVERB_ALLOWED_ORIGINS` — домен окружения) только если задан секрет `REVERB_APP_SECRET` (вместе с `REVERB_APP_ID` и `REVERB_APP_KEY`; вводит OWNER в секреты окружения `stage` и `production`, значения у окружений разные). Без секрета — `BROADCAST_CONNECTION=null`: события не уходят в очередь, сообщения работают без реального времени, текст не пишется в журнал. Проверка прокси вручную после выкатки: `deploy/bin/smoke-reverb.sh <домен> <REVERB_APP_KEY>` (на stage с `SMOKE_BASIC_AUTH=пользователь:пароль`) — рукопожатие wss, ответ 101 и `pusher:connection_established`. Доставка сообщения во вторую вкладку — шаг чек-листа G1.

Production выкатывается поэтапно: флаг `r1_public` в Pennant для 10 % → 50 % → 100 % посетителей.

Выкатка production: `gh workflow run release.yml --ref main -f tag=vX.Y.Z` (запускает только OWNER). Версии `v0.*` в production не выкатываются.
