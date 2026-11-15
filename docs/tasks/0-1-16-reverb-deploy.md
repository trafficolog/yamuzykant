---
id: "0.1.16"
phase: "0"
epic: "0.1"
title: "Reverb на stage и production: процесс, wss-прокси, переменные"
status: in_progress
gate: G1
risk: medium
model_impl: sonnet
model_review: opus
roles: ["DEVOPS"]
depends_on: ["4.1.1", "0.1.12"]
uc: []
prototype: ""
screens: []
issue: 121
sync_state: drifted
escalations: []
---

# 0.1.16. Reverb на stage и production: процесс, wss-прокси, переменные

## Цель
Сообщения доходят в реальном времени на stage так же, как в e2e (ревью PR #119, п. 7).

## Что сделать
- Пока Reverb не запущен — `BROADCAST_CONNECTION=null` в окружениях stage и production (deploy.sh); проверка, что деплой не включает reverb без процесса
- systemd-юнит `reverb:start` (перезапуск при деплое, `reverb:restart`), лимиты открытых файлов
- Nginx: location для wss с upgrade, TLS, таймауты; `REVERB_ALLOWED_ORIGINS` — домен окружения
- Секреты `REVERB_APP_ID/KEY/SECRET` — GitHub Secrets окружения (вводит OWNER); переменные — в docs/02-process/CI-CD.md §5
- Smoke на stage: сообщение видно во второй вкладке ≤ 2 с; результат — в файл сессии

## Критерии приёмки
- [ ] На stage сообщение доставляется в реальном времени по wss
- [ ] Деплой без Reverb не роняет очередь заданиями трансляции
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- deploy-тесты: юнит, конфиг Nginx, переменные

## Не делать
- Горизонтальное масштабирование Reverb (Redis scaling) — после R1

## Ссылки
- PR #119 (комментарий ревьюера, п. 7) · ARCHITECTURE §6, §9 · docs/02-process/CI-CD.md
