---
id: "3.1.8"
phase: "3"
epic: "3.1"
title: "Поисковый индекс: доработки после ревью"
status: review
gate: G1
risk: low
model_impl: sonnet
model_review: sonnet
roles: ["BACK", "DEVOPS"]
depends_on: ["3.1.1"]
uc: ["S2", "S3"]
prototype: ""
screens: []
issue: 108
sync_state: drifted
escalations: []
---

# 3.1.8. Поисковый индекс: доработки после ревью

## Цель
Индекс объявлений заполнен сразу после выкатки, не хранит устаревших документов и не может удалить чужой индекс (неблокирующие замечания ревью PR #107).

## Что сделать
- `deploy/scout-import.txt`: добавить `Listing`, чтобы после первой выкатки индекс не был пуст до ночной сверки
- Job синхронизации: middleware `WithoutOverlapping` по id объявления — гонка «публикация читает строку → снятие удаляет документ → публикация пишет устаревший документ»
- `listings:seed-load`: имя индекса только с префиксом `listings_bench`, иначе ошибка
- Тесты: экранирование категории в filter (`"` и `\`); поведенческие тесты синхронизации для `ListingApproved`, `ListingResubmitted`, `ListingRelisted`, `ListingReturned`, `ListingRejected`; тест «все события подписаны» без опоры на wildcard
- Индекс `instrument_models` — с префиксом окружения (`SCOUT_PREFIX`), чтобы параллельные прогоны не мешали друг другу
- Версия Meilisearch одна в CI и docker-compose
- Нестабильный тест `ReconcileListingIndexTest`: нарушение `cities_name_region_unique` в CI (PR #113, #117, #123) — фабрика городов с уникальными значениями; тест мигает в CI у всех
- Убрать `_geo` из документа и настроек индекса и сортировку `_geoPoint` (решение OWNER 07.11.2026: «рядом» в MVP нет)

## Критерии приёмки
- [ ] После `deploy.sh` на пустом индексе опубликованные объявления находятся без ожидания сверки
- [ ] `listings:seed-load --index=instrument_models` завершается ошибкой, индекс не тронут (тест)
- [ ] Параллельные job публикации и снятия не оставляют документ в индексе (тест)
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest: экранирование filter, события синхронизации, защита seed-load, WithoutOverlapping

## Не делать
- Resource для выдачи — в 3.1.2

## Ссылки
- PR #107 (комментарий ревьюера, N1–N4, N7, N8) · ARCHITECTURE §5
