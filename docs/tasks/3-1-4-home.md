---
id: "3.1.4"
phase: "3"
epic: "3.1"
title: "Главная"
status: todo
gate: G1
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["FRONT", "BACK"]
depends_on: ["3.1.2"]
uc: ["S2"]
prototype: "Десктоп - Главная.dc.html"
screens: ["home"]
issue: 29
sync_state: drifted
escalations: []
---

# 3.1.4. Главная

## Цель
Главная ведёт в поиск и показывает свежие объявления города.

## Что сделать
- Блоки из макета: поиск, категории (8), рельсы «Новые в {городе}», «Готовы к торгу», TrustStrip (тексты пропсом), блок «Продать инструмент»
- Рельсы вне MVP — по флагам
- Кэш блоков 60 с на город

## Критерии приёмки
- [ ] Главная в пороге эталона `home`
- [ ] Пустой город → рельс заменяется ссылкой на всю Россию
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Playwright visual: home
- Pest feature: props главной по городу

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-S2 · docs/00-product/SPEC.md
- Макет: design/prototypes/Десктоп - Главная.dc.html · эталоны: design/screens/home@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
