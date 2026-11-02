---
id: "0.1.7"
phase: "0"
epic: "0.1"
title: "Larastan для tests/ и config/"
status: todo
gate: G1
risk: low
model_impl: haiku
model_review: sonnet
roles: ["DEVOPS"]
depends_on: ["0.1.3"]
uc: []
prototype: ""
screens: []
issue: 66
sync_state: drifted
escalations: []
---

# 0.1.7. Larastan для tests/ и config/

## Цель
Статический анализ уровня 8 покрывает тесты и конфиги, а не только `app/` (замечание ревью PR #65).

## Что сделать
- Подключить Pest-плагин для PHPStan (или эквивалент), чтобы `$this` в замыканиях Pest разбирался
- Вернуть `tests/` и `config/` в `phpstan.neon`; ошибки `env()` в config/ — исправить или baseline с обоснованием
- Убрать комментарий-исключение из `phpstan.neon`

## Критерии приёмки
- [ ] `composer analyse` проверяет `app/`, `tests/`, `config/` на уровне 8 без ошибок (baseline — только с перечнем причин в PR)
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- CI-шаг `composer analyse` падает на намеренной ошибке типов в `tests/` (проверка в PR)

## Не делать
- Понижать уровень анализа

## Ссылки
- PR #65 · комментарий ревьюера, неблокирующее замечание 3
