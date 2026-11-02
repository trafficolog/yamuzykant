---
id: "3.1.3"
phase: "3"
epic: "3.1"
title: "Барахолка: пусто, загрузка, ошибка"
status: todo
gate: G1
risk: low
model_impl: haiku
model_review: sonnet
roles: ["FRONT"]
depends_on: ["3.1.2"]
uc: ["S3"]
prototype: "Десктоп - Каталог.dc.html"
screens: ["flea-empty"]
issue: null
sync_state: drifted
escalations: []
---

# 3.1.3. Барахолка: пусто, загрузка, ошибка

## Цель
Выдача понятна в любом состоянии.

## Что сделать
- Пусто: EmptyState с предложением снять самый узкий фильтр и кнопкой сохранить поиск (по 4.3.2)
- Загрузка: скелетоны ListingCard без сдвига раскладки
- Ошибка поиска: Alert с повтором

## Критерии приёмки
- [ ] Пустая выдача в пороге эталона `flea-empty`
- [ ] CLS при загрузке ≤ 0,05
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Playwright visual: flea-empty
- Playwright: имитация ошибки поиска

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-S3 · docs/00-product/SPEC.md
- Макет: design/prototypes/Десктоп - Каталог.dc.html · эталоны: design/screens/flea-empty@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
