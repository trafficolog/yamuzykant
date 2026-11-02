---
id: "6.1.1"
phase: "6"
epic: "6.1"
title: "Мобильная шапка и нижняя панель"
status: todo
gate: G1
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["FRONT"]
depends_on: ["0.2.4"]
uc: []
prototype: "Шапка.dc.html"
screens: ["header"]
issue: 53
sync_state: drifted
escalations: []
---

# 6.1.1. Мобильная шапка и нижняя панель

## Цель
На < 640 px сайт работает как мобильное приложение.

## Что сделать
- Мобильная шапка: Wordmark, город, поиск во второй строке
- `MobileTabBar`: Главная, Поиск, Продать, Сообщения (счётчик), Кабинет; safe-area
- Меню категорий — полноэкранная шторка

## Критерии приёмки
- [ ] Шапка и подвал в пороге эталонов `@390`
- [ ] Зона нажатия ≥ 44 px; на 320 px нет горизонтальной прокрутки
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Playwright visual: header@390, footer@390
- Playwright: 320 px без прокрутки

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: — · docs/00-product/SPEC.md
- Макет: design/prototypes/Шапка.dc.html · эталоны: design/screens/header@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
