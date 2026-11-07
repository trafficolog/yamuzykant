---
id: "3.1.2"
phase: "3"
epic: "3.1"
title: "Барахолка: выдача и фильтры"
status: review
gate: G1
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["FRONT", "BACK"]
depends_on: ["3.1.1", "0.2.4", "1.1.4"]
uc: ["S2", "S3"]
prototype: "Десктоп - Каталог.dc.html"
screens: ["flea"]
issue: 27
sync_state: drifted
escalations: []
---

# 3.1.2. Барахолка: выдача и фильтры

## Цель
Покупатель находит объявления в своём городе.

## Что сделать
- Страница `/baraholka` и `/baraholka/{категория}`: хлебные крошки, заголовок со счётчиком, фильтры слева, сетка ListingCard
- Фильтры: категория, состояние, цена от–до, «Готов к торгу», доставка; город — из шапки (без фильтра)
- Сортировки: новые, дешевле, дороже (сортировки «ближе» в MVP нет — решение OWNER 07.11.2026)
- URL отражает фильтры; пагинация «Показать ещё» + номера страниц для SEO
- CatalogSwitch и чип «Безопасная сделка» — по флагам (off)

## Критерии приёмки
- [ ] Выдача в пороге эталона `flea`
- [ ] Обновление страницы сохраняет фильтры
- [ ] Назад в браузере возвращает к той же позиции выдачи
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Playwright visual: flea
- Playwright UC-S2.spec.ts, UC-S3.spec.ts
- Pest feature: маппинг query → фильтры

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-S2, UC-S3 · docs/00-product/SPEC.md
- Макет: design/prototypes/Десктоп - Каталог.dc.html · эталоны: design/screens/flea@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
