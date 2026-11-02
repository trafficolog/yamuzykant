---
id: "4.3.1"
phase: "4"
epic: "4.3"
title: "Избранное"
status: todo
gate: G1
risk: low
model_impl: haiku
model_review: sonnet
roles: ["BACK", "FRONT"]
depends_on: ["3.1.5", "1.1.2", "4.4.1"]
uc: ["S5"]
prototype: "Десктоп - Кабинет.dc.html"
screens: ["account"]
issue: 38
sync_state: drifted
escalations: []
---

# 4.3.1. Избранное

## Цель
Пользователь сохраняет объявления и видит их в кабинете.

## Что сделать
- favorites (user_id, listing_id); FavoriteButton на карточке и лоте; гость → вход
- Вкладка «Избранное»: снятые помечены, снижение цены подсвечено
- Письмо о снижении цены по шаблону 4.4.1 (если включено в профиле)

## Критерии приёмки
- [ ] Сердце меняет состояние оптимистично и откатывается при ошибке
- [ ] Снятое объявление в избранном — с плашкой «Снято с продажи»
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature
- Playwright UC-S5.spec.ts

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-S5 · docs/00-product/SPEC.md
- Макет: design/prototypes/Десктоп - Кабинет.dc.html · эталоны: design/screens/account@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
