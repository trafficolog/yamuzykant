---
id: "3.1.1"
phase: "3"
epic: "3.1"
title: "Поисковый индекс объявлений"
status: todo
gate: G1
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["BACK"]
depends_on: ["2.1.1"]
uc: ["S2", "S3"]
prototype: ""
screens: []
issue: null
sync_state: drifted
escalations: []
---

# 3.1.1. Поисковый индекс объявлений

## Цель
Опубликованные объявления ищутся с фасетами, геофильтром и опечатками.

## Что сделать
- Scout + Meilisearch: индекс `listings` по ARCHITECTURE §5
- Job `SyncListingToIndex` по событиям статуса; ночная сверка
- Настройки: фильтруемые и сортируемые поля, синонимы, стоп-слова, ранжирование
- Сид 100 тыс. объявлений для нагрузочной проверки (отдельная команда)

## Критерии приёмки
- [ ] Снятое объявление исчезает из выдачи ≤ 60 с
- [ ] В индексе нет серийного номера, e-mail, user_id
- [ ] p95 поиска ≤ 300 мс на 100 тыс. (отчёт в PR)
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature с настоящим Meilisearch: индексация, удаление, фильтры
- Скрипт замера p95

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-S2, UC-S3 · docs/00-product/SPEC.md

