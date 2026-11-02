---
id: "0.1.2"
phase: "0"
epic: "0.1"
title: "Локальное окружение Docker Compose"
status: in_progress
gate: G0
risk: low
model_impl: haiku
model_review: sonnet
roles: ["DEVOPS"]
depends_on: ["0.1.1"]
uc: []
prototype: ""
screens: []
issue: 2
sync_state: drifted
escalations: []
---

# 0.1.2. Локальное окружение Docker Compose

## Цель
Одна команда поднимает все сервисы для разработки и e2e.

## Что сделать
- `compose.yaml`: pgsql 16, redis 7, meilisearch 1.x, mailpit, minio (S3), с healthcheck
- `.env.example` с рабочими значениями для compose
- `make up`, `make down`, `make fresh` (migrate:fresh --seed), `make e2e`
- Раздел «Локальный запуск» в README.md

## Критерии приёмки
- [ ] `make up && php artisan migrate` на чистой машине работает без правок .env
- [ ] Письма видны в Mailpit, файлы пишутся в MinIO
- [ ] Meilisearch доступен приложению по ключу из .env
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature: подключение к БД, Redis, S3 (fake disk не используется в этом тесте), Meilisearch health

## Не делать
- Не использовать Sail, если OWNER не попросит — достаточно compose

## Ссылки
- SPEC: — · docs/00-product/SPEC.md

