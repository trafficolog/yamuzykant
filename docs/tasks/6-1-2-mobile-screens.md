---
id: "6.1.2"
phase: "6"
epic: "6.1"
title: "Мобильная раскладка экранов"
status: todo
gate: G3
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["FRONT"]
depends_on: ["6.1.1", "3.1.2", "3.1.5", "2.1.3", "4.1.2", "2.1.5"]
uc: []
prototype: "design/ds/ui_kits/marketplace/mobile.html"
screens: []
issue: 54
sync_state: drifted
escalations: []
---

# 6.1.2. Мобильная раскладка экранов

## Цель
Все экраны MVP удобны на телефоне.

## Что сделать
- Барахолка: 2 колонки, фильтры в шторке с кнопкой «Показать N»
- Лот: галерея на всю ширину, закреплённая панель «Написать / Предложить цену»
- Продать: шаги друг под другом, превью скрыто, закреплённая кнопка
- Сообщения: список и чат — отдельные экраны
- Кабинет: вкладки — горизонтальная прокрутка

## Критерии приёмки
- [ ] Чек-лист SCREENS.md §3 на каждом экране (скриншоты 390 в PR)
- [ ] OWNER принимает раскладку на G3
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Playwright: UC-S3, UC-L1, UC-D1 на viewport 390

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: — · docs/00-product/SPEC.md
- Макет: design/ds/ui_kits/marketplace/mobile.html
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
