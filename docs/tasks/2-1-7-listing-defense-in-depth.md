---
id: "2.1.7"
phase: "2"
epic: "2.1"
title: "Объявление: защита владельца и смены статуса в глубину"
status: done
gate: G1
risk: medium
model_impl: sonnet
model_review: opus
roles: ["BACK", "SEC"]
depends_on: ["2.1.1"]
uc: ["L1", "L3"]
prototype: ""
screens: []
issue: 105
sync_state: aligned
escalations: []
---

# 2.1.7. Объявление: защита владельца и смены статуса в глубину

## Цель
Ни один путь в коде не может сменить владельца объявления или его статус в обход `ListingStateMachine` (неблокирующие замечания ревью PR #100, круг 2).

## Что сделать
- Хук `saving` модели `Listing`: смена `user_id` у существующей записи — `LogicException` (мутация `forceFill(['user_id'=>…])->save()` должна падать)
- `Listing::withStatusChange()` — правило arch-теста / `StatusWriteScanner`: вызывать можно только из `app/Domain/Listings/StateMachines`
- Флаг разрешения смены статуса — не статический на процесс (или сброс в `finally` + комментарий про Octane)

## Критерии приёмки
- [ ] `forceFill(['user_id' => другой])->save()` и `update(['user_id' => …])` у существующего объявления — исключение (тест)
- [ ] Вызов `withStatusChange()` вне StateMachines роняет arch-тест (тест на фикстуре)
- [ ] Исключение внутри перехода не оставляет разрешение смены статуса включённым (тест)
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest: хук saving для user_id; arch-сканер на фикстуре; сброс флага при исключении

## Не делать
- Менять таблицу переходов и правило существенной правки

## Ссылки
- PR #100 (комментарий ревьюера, круг 2) · AGENTS.md §4
