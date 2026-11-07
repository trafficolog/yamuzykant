---
id: "0.1.14"
phase: "0"
epic: "0.1"
title: "Наблюдаемость: доработки после ревью и проверка на stage"
status: todo
gate: G1
risk: low
model_impl: sonnet
model_review: sonnet
roles: ["BACK", "DEVOPS"]
depends_on: ["0.1.5", "0.1.12"]
uc: []
prototype: ""
screens: []
issue: 110
sync_state: drifted
escalations: []
---

# 0.1.14. Наблюдаемость: доработки после ревью и проверка на stage

## Цель
Ошибки stage видны в Sentry с release и request_id, а `/health` устойчив к сбоям хранилища и подделке адреса (неблокирующие замечания ревью PR #106).

## Что сделать
- Регрессионный тест: запрос снаружи с `X-Forwarded-For: 127.0.0.1` получает только `{status}`
- `/health` не открывает сессию: в ответе нет `Set-Cookie` (тест)
- `ThrottleHealth`: при недоступном файловом store запрос пропускается без лимита, а не 500 (тест)
- `.env.example`: `HEALTH_TOKEN` — отдельным блоком, не внутри Sentry
- Тег Sentry `request_id` в событиях из заданий очереди (из Context) и во фронтовых событиях (из заголовка ответа / meta)
- Horizon dashboard только для сотрудников — если Horizon ставится в MVP (решение OWNER на G1); иначе пункт закрыть с записью в DEVIATIONS
- Ручная проверка на stage после того, как OWNER задаст `SENTRY_LARAVEL_DSN` и `VITE_SENTRY_DSN`: тестовое исключение видно в Sentry с release и request_id; результат — в файл сессии

## Критерии приёмки
- [ ] Исключение на stage видно в Sentry с release и request_id (скриншот или ссылка на событие в файле сессии)
- [ ] Тесты на X-Forwarded-For, Set-Cookie и отказ store зелёные
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest: HealthAccessTest (XFF, Set-Cookie, отказ store), тег request_id в job

## Не делать
- Алерты и дежурство — 6.4.3

## Ссылки
- PR #106 (комментарии ревьюера, круги 1–2) · ARCHITECTURE §9
