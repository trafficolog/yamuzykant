---
id: "4.3.2"
phase: "4"
epic: "4.3"
title: "Сохранённые поиски"
status: todo
gate: G2
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["BACK", "FRONT"]
depends_on: ["3.1.2", "4.4.1"]
uc: ["S4"]
prototype: "Десктоп - Кабинет.dc.html"
screens: ["account"]
issue: 39
sync_state: drifted
escalations: []
---

# 4.3.2. Сохранённые поиски

## Цель
Пользователь получает новые объявления по своему запросу.

## Что сделать
- saved_searches (query jsonb, city_id, frequency: instant|daily)
- Кнопка «Сохранить поиск» на Барахолке; вкладка «Поиски» в кабинете
- Job: новые объявления по поискам → уведомление и письмо (дайджест)

## Критерии приёмки
- [ ] Новое объявление, подходящее под поиск, приходит в уведомления ≤ 5 мин (instant)
- [ ] Дайджест daily — одно письмо в 10:00 мск
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature: совпадение, частота
- Playwright UC-S4.spec.ts

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-S4 · docs/00-product/SPEC.md
- Макет: design/prototypes/Десктоп - Кабинет.dc.html · эталоны: design/screens/account@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
