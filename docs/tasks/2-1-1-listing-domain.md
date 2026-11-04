---
id: "2.1.1"
phase: "2"
epic: "2.1"
title: "Объявление: модель и жизненный цикл"
status: done
gate: G1
risk: high
model_impl: opus
model_review: opus
roles: ["DB", "BACK"]
depends_on: ["1.2.1", "1.1.1"]
uc: ["L1", "L3", "L4"]
prototype: ""
screens: []
issue: 20
sync_state: aligned
escalations: []
---

# 2.1.1. Объявление: модель и жизненный цикл

## Цель
Объявление со статусами SPEC §6.1, переходы только через state machine.

## Что сделать
- Миграции: listings, listing_photos, sale_records, moderation_decisions (поля SPEC §7)
- Enum `ListingStatus`, `ListingStateMachine` с событиями на каждый переход
- Серийный номер — `encrypted`, метод `serialMasked()`
- Правило «существенная правка» (SPEC §6.1) — в одном месте: фото, модель, категория, название, серийный номер, описание, состояние (решение OWNER 04.11.2026)
- Снятие с продажи (withdraw) — из published, pending, needs_changes, expired; итоговая цена — только при «продал» из published/expired; срок показа 60 дней (подтверждено OWNER)
- Флаг Pennant `premoderation` (выключен): publish ведёт `draft → published`, существенная правка оставляет `published`; при включённом флаге — переходы через `pending` по SPEC §6.1
- `ListingPolicy`: владелец, сотрудник, гость

## Критерии приёмки
- [ ] Каждый переход диаграммы SPEC §6.1 работает; любой другой — исключение `IllegalTransition`
- [ ] Снижение цены у published не меняет статус; изменение фото переводит в pending только при включённом `premoderation`
- [ ] Обе ветки флага `premoderation` покрыты таблицей переходов
- [ ] Серийный номер в БД не читается без ключа; маска `V09****`
- [ ] Прямое изменение status вне машины ловит arch-тест
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest unit: таблица всех пар (from, event) — 100 % веток
- Pest arch: запрет `->status =` и `update([...status...])` вне StateMachines
- Pest unit: маска серийного номера

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-L1, UC-L3, UC-L4 · docs/00-product/SPEC.md

