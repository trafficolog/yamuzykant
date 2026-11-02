---
id: "0.1.4"
phase: "0"
epic: "0.1"
title: "Окружение stage и автодеплой"
status: todo
gate: G1
risk: high
model_impl: opus
model_review: opus
roles: ["DEVOPS"]
depends_on: ["0.1.3"]
uc: []
prototype: ""
screens: []
issue: null
sync_state: drifted
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

