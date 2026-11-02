---
id: "6.4.3"
phase: "6"
epic: "6.4"
title: "Алерты и дежурство"
status: todo
gate: G3
risk: low
model_impl: haiku
model_review: sonnet
roles: ["DEVOPS"]
depends_on: ["0.1.5", "6.4.1"]
uc: []
prototype: ""
screens: []
issue: 63
sync_state: drifted
escalations: []
---

# 6.4.3. Алерты и дежурство

## Цель
О проблемах узнаём раньше пользователей.

## Что сделать
- Алерты: 5xx > 1 % 5 мин, очередь старше 5 мин, /health не 200, диск > 80 %, бэкап не создан, Reverb недоступен
- Канал оповещения (уточнить: Telegram/почта), дежурный (уточнить)
- Ранбук: что делать по каждому алерту — docs/operations/RUNBOOK.md

## Критерии приёмки
- [ ] Каждый алерт проверен искусственным срабатыванием
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Протокол проверки алертов

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: — · docs/00-product/SPEC.md

