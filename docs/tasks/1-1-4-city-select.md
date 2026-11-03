---
id: "1.1.4"
phase: "1"
epic: "1.1"
title: "Выбор города"
status: done
gate: G1
risk: low
model_impl: haiku
model_review: sonnet
roles: ["FRONT", "BACK"]
depends_on: ["0.2.4", "1.2.1"]
uc: ["S1"]
prototype: "Шапка.dc.html"
screens: ["header"]
issue: 16
sync_state: aligned
escalations: []
---

# 1.1.4. Выбор города

## Цель
Город в шапке задаёт выдачу на всём сайте (BR-01).

## Что сделать
- `Components/CitySelect` в шапке: поиск по справочнику, популярные города
- Хранение: у вошедшего — users.city_id, у гостя — cookie; по умолчанию — по IP (GeoLite, уточнить) или Москва
- Shared prop `city`

## Критерии приёмки
- [ ] Смена города мгновенно меняет выдачу Барахолки и рельсы главной
- [ ] У гостя город сохраняется между визитами
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature: cookie и users.city_id
- Playwright UC-S1.spec.ts

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-S1 · docs/00-product/SPEC.md
- Макет: design/prototypes/Шапка.dc.html · эталоны: design/screens/header@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
