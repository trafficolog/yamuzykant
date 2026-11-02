# CI/CD на GitHub

## 1. Workflows

| Файл | Когда | Что делает |
|---|---|---|
| `.github/workflows/ci.yml` | каждый PR и push в `main` | jobs `docs`, `php`, `js`, `e2e` — обязательные проверки |
| `.github/workflows/deploy.yml` | push в `main` после зелёного CI | сборка и выкатка на `stage` |
| `.github/workflows/release.yml` | тег `v*` | сборка, выкатка на `production` после подтверждения OWNER в окружении, GitHub Release |

До задачи `0.1.1` (в репозитории ещё нет Laravel) job `detect` выдаёт `app=false`, и jobs `php`, `js`, `e2e` пропускаются (для обязательных проверок пропуск = успех); `docs` работает сразу. `deploy.yml` пропускает выкатку, пока нет `deploy/deploy.sh`.

## 2. Состав CI

- **docs:** `node tools/docs-ops.mjs check` (структура карточек, зависимости, гейты), `node tools/lint-copy.mjs`.
- **php:** PHP 8.3, сервисы PostgreSQL 16, Redis 7, Meilisearch → `composer install` → `pint --test` → `phpstan analyse` (Larastan 8) → `pest --coverage --min=75` (+ домен ≥ 90 % через отдельный `--coverage-filter`).
- **js:** Node 20 → `npm ci` → `eslint` → `tsc --noEmit` → `vitest run --coverage` → `vite build && vite build --ssr`.
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
| `stage` | без подтверждения | `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `APP_KEY`, `DB_PASSWORD`, `MEILISEARCH_KEY`, `REVERB_APP_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `MAIL_PASSWORD`, `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`, `SENTRY_DSN` |
| `production` | обязательный ревьюер OWNER, только теги `v*` | те же, свои значения |

CI использует только тестовые значения из `ci.yml`; реальные секреты в CI не нужны.

## 6. Выкатка

Скрипт выкатки — `deploy/deploy.sh` (создаёт задача 0.1.4). По умолчанию — zero-downtime через Deployer или Envoy: релизная папка, `composer install --no-dev`, `npm ci && npm run build`, `php artisan migrate --force`, `config:cache`, `route:cache`, `horizon:terminate`, `reverb:restart`, SSR-процесс через Supervisor, переключение симлинка, проверка `/health`. Откат — переключение на предыдущий релиз; миграции совместимы на одну версию назад (expand → migrate → contract).

Production выкатывается поэтапно: флаг `r1_public` в Pennant для 10 % → 50 % → 100 % посетителей.
