---
id: "2.1.8"
phase: "2"
epic: "2.1"
title: "Объявление: защита владельца на уровне БД и сканера"
status: done
gate: G1
risk: low
model_impl: sonnet
model_review: sonnet
roles: ["BACK", "DB", "SEC"]
depends_on: ["2.1.7"]
uc: ["L1"]
prototype: ""
screens: []
issue: 114
sync_state: aligned
escalations: []
---

# 2.1.8. Объявление: защита владельца на уровне БД и сканера

## Цель
Владельца объявления нельзя сменить и путями, которые обходят события модели (неблокирующие замечания ревью PR #112).

## Что сделать
- Закрыть обходы: `saveQuietly()` после присваивания `user_id`, `Listing::query()->update(['user_id' => …])`, `DB::table('listings')->update(...)` — триггер PostgreSQL `BEFORE UPDATE OF user_id` (ошибка, если значение меняется) или правило сканера для записи `user_id` вне создания; выбор обосновать в PR
- Тест на присваивание и `setAttribute('user_id')` + `save()`
- `StatusWriteScanner`: исключение только для `app/Domain/Listings/StateMachines`, а не любого каталога `StateMachines`; ограничения (callable-массив, `call_user_func`, динамическое имя, строковый литерал) — в докблоке
- `Listing::fill()`: при незагруженной колонке `user_id` и включённом запрете ленивых атрибутов — `LogicException`, а не `MissingAttributeException` (или явная проверка `hasAttribute`)

## Критерии приёмки
- [ ] `saveQuietly()` и запрос-построитель со сменой `user_id` — ошибка (тест на pgsql)
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest: обходы через saveQuietly, query()->update, DB::table; сканер с узким исключением

## Не делать
- Передачу объявления другому пользователю (не предусмотрено SPEC)

## Ссылки
- PR #112 (комментарий ревьюера, п. 1–4, 6) · AGENTS.md §4
