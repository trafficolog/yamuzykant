---
id: "4.1.6"
phase: "4"
epic: "4.1"
title: "Быстрые ответы в чате (бэклог)"
status: todo
gate: G3
risk: low
model_impl: haiku
model_review: sonnet
roles: ["FRONT"]
depends_on: ["4.1.5"]
uc: []
prototype: ""
screens: ["messages"]
issue: 135
sync_state: drifted
escalations: []
---

# 4.1.6. Быстрые ответы в чате (бэклог)

## Цель
Готовые фразы для покупателя и продавца — после MVP (решение OWNER 08.11.2026).

## Что сделать
- Наборы фраз для покупателя («Ещё продаётся?») и продавца — согласовать с OWNER
- Кнопки над полем ввода, тексты в lang

## Критерии приёмки
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Vitest: выбор фразы заполняет поле

## Не делать
- Автоответы

## Ссылки
- Решение OWNER 08.11.2026 · docs/operations/gates/G1.md
