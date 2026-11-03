---
id: "0.1.4"
phase: "0"
epic: "0.1"
title: "Окружение stage и автодеплой"
status: done
gate: G1
risk: high
model_impl: opus
model_review: opus
roles: ["DEVOPS"]
depends_on: ["0.1.3", "0.1.10"]
uc: []
prototype: ""
screens: []
issue: 4
sync_state: aligned
escalations: []
---

# 0.1.4. Окружение stage и автодеплой

## Цель
Каждый мерж в main через ≤ 15 мин доступен на stage.

## Что сделать
- Сервер или контейнеры в облаке РФ (выбор — OWNER): PHP-FPM, Nginx, Node SSR, Horizon, Reverb, Scheduler под Supervisor
- PostgreSQL, Redis, Meilisearch, S3-бакет, CDN для фото
- `deploy/deploy.sh` (zero-downtime, релизные папки, откат) и `.github/workflows/deploy.yml`
- HTTPS, домен stage (уточнить), basic-auth на stage
- Окружение GitHub `stage` и секреты (значения вводит OWNER)

- Веб-сервер: долгий `Cache-Control: public, max-age=31536000` для `/fonts/*` (файлы без хеша — без `immutable`, ревью PR #84) и для `/build/*` (с хешем — `immutable`)
- `trustProxies`: OWNER сообщает, что стоит перед сервером (CDN, балансировщик) — их адреса в `bootstrap/app.php`; без прокси — только 127.0.0.1; тест, что поддельный `X-Forwarded-For` не меняет IP для лимитов (решение OWNER 03.11.2026)
- Воркеры очереди (Horizon) слушают `high,default` — письма с кодом входа идут в `high`
- `deploy.sh` получает SHA только из проверенного источника: в release.yml — `needs.authorize.outputs.sha` и в `with.ref`, и в `env.SHA`; тест в workflow-guards (ревью PR #83, N8, N9: `if: false` у шага authorize, литерал `--tag`, `--allowlist /dev/stdin` тоже должны ронять тесты)
- Окружение `stage` ограничено веткой `main` (deployment branch policy, включено 03.11.2026); выкатка — только `deploy.yml` после зелёного CI на push в main

- Сервер stage (решение OWNER 03.11.2026): чистый VPS Ubuntu, без прокси/CDN (trustProxies — только 127.0.0.1); почта на stage — Mailpit на сервере (веб-интерфейс за паролем), файлы — MinIO на сервере; реальные провайдеры — к production
- Provisioning — идемпотентный скрипт в репозитории (`deploy/provision.sh`): Nginx, PHP 8.3-FPM, PostgreSQL 16, Redis 7, Meilisearch, Supervisor (Horizon `high,default`, Reverb, SSR), Mailpit, MinIO, certbot (HTTPS); запускается workflow_dispatch-job только из `main` по SSH-ключу
- Первая настоящая выкатка — после 0.1.12 (сейчас в `DEPLOY_SSH_KEY` пароль); до этого — dry-run и проверка скриптов (shellcheck, тесты)

## Критерии приёмки
- [ ] Мерж в main → stage обновлён, `/health` 200
- [ ] `deploy/deploy.sh rollback` возвращает предыдущий релиз ≤ 1 мин
- [ ] Horizon, Reverb, SSR живы после деплоя (проверка в скрипте)
- [ ] Миграции выполняются в деплое, падение миграции отменяет переключение
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Ручная проверка с протоколом в PR: деплой, откат, повторный деплой

## Не делать
- Не настраивать production — задача 6.4.1

## Ссылки
- SPEC: — · docs/00-product/SPEC.md

