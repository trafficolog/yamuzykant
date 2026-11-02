---
id: "6.2.1"
phase: "6"
epic: "6.2"
title: "Страницы ошибок и техработ"
status: todo
gate: G3
risk: low
model_impl: haiku
model_review: sonnet
roles: ["FRONT", "BACK"]
depends_on: ["0.2.4"]
uc: []
prototype: "Десктоп - Ошибка.dc.html"
screens: ["error"]
issue: 55
sync_state: drifted
escalations: []
---

# 6.2.1. Страницы ошибок и техработ

## Цель
Ошибки понятны и ведут дальше.

## Что сделать
- Inertia-страницы 403, 404, 410, 419, 429, 500, 503 по макету
- Режим техработ (`php artisan down` со своим шаблоном и секретом обхода)

## Критерии приёмки
- [ ] 404 в пороге эталона `error`
- [ ] 500 не раскрывает детали и содержит request_id
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature: каждый код
- Playwright visual: error

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: — · docs/00-product/SPEC.md
- Макет: design/prototypes/Десктоп - Ошибка.dc.html · эталоны: design/screens/error@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
