---
id: "0.1.9"
phase: "0"
epic: "0.1"
title: "Флаги и тестовый каркас: доработки после ревью"
status: todo
gate: G1
risk: low
model_impl: haiku
model_review: sonnet
roles: ["BACK", "FRONT"]
depends_on: ["0.1.6"]
uc: []
prototype: ""
screens: []
issue: 77
sync_state: drifted
escalations: []
---

# 0.1.9. Флаги и тестовый каркас: доработки после ревью

## Цель
Неблокирующие замечания ревью PR #74 закрыты до массового появления страниц в G1.

## Что сделать
- Тип `FlagName` на фронте сверяется с enum `FeatureFlag` (тест сверки или генерация типов)
- Shared prop `flags` — один запрос `Feature::for(null)->values([...])` вместо вызова `active()` на каждый флаг
- `RefreshDatabase` — в `TestCase` для Feature-тестов с явным исключением для тестов без БД (Health), вместо перечня файлов в `tests/Pest.php`

## Критерии приёмки
- [ ] Новый флаг в enum без правки `FlagName` роняет тест
- [ ] Inertia-ответ делает не больше одного запроса к таблице `features` (тест с `DB::listen`)
- [ ] Новый Feature-тест Inertia-страницы работает без добавления в `tests/Pest.php`
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Vitest/Pest: сверка имён флагов; Pest: число запросов; Pest: тест-пример без регистрации

## Не делать
- Менять список флагов и их значения по умолчанию

## Ссылки
- PR #74 (комментарий ревьюера, п. 2–4)
