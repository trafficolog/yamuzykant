---
id: "0.1.6"
phase: "0"
epic: "0.1"
title: "Фича-флаги Pennant"
status: todo
gate: G0
risk: low
model_impl: haiku
model_review: sonnet
roles: ["BACK", "FRONT"]
depends_on: ["0.1.1"]
uc: []
prototype: ""
screens: []
issue: null
sync_state: drifted
escalations: []
---

# 0.1.6. Фича-флаги Pennant

## Цель
Элементы макетов вне MVP скрыты флагами, флаги доступны на фронте.

## Что сделать
- Laravel Pennant, драйвер database
- Флаги: `catalog_new`, `masters`, `sale_prices`, `accessories`, `companies`, `wallet`, `safe_deal`, `r1_public` — все off
- Shared prop Inertia `flags` и хук `useFlag(name)`

## Критерии приёмки
- [ ] `useFlag("masters")` = false по умолчанию
- [ ] Включение флага в БД меняет prop без деплоя
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest: shared prop flags
- Vitest: useFlag

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: — · docs/00-product/SPEC.md

