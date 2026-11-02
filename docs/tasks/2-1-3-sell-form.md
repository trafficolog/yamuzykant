---
id: "2.1.3"
phase: "2"
epic: "2.1"
title: "Форма «Продать инструмент»"
status: todo
gate: G1
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["FRONT", "BACK"]
depends_on: ["2.1.2", "1.2.2"]
uc: ["L1"]
prototype: "Десктоп - Продать.dc.html"
screens: ["sell"]
issue: 22
sync_state: drifted
escalations: []
---

# 2.1.3. Форма «Продать инструмент»

## Цель
Продавец заполняет объявление за 4 шага на одной странице по макету.

## Что сделать
- Шаги: что продаёте (8 видов, модель, год, серийный номер) → фото → состояние (8 ступеней с пояснением) и описание → цена, «Готов к торгу», передача
- Превью ListingCard справа (sticky) обновляется на лету
- Блок списка недостающего над кнопкой; кнопка неактивна, пока список не пуст
- PriceGuide и блок мастера — по флагам (off)
- Form Request с теми же правилами, что на клиенте

## Критерии приёмки
- [ ] Пустая форма в пороге эталона `sell`
- [ ] При 2 фото над кнопкой «добавьте: ещё 1 фото»
- [ ] Цена форматируется «184 500»; ввод букв игнорируется
- [ ] Серверная валидация отклоняет запрос в обход клиента
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Playwright visual: sell
- Playwright UC-L1.spec.ts (часть 1: заполнение)
- Pest feature: StoreListingRequest — каждое правило

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-L1 · docs/00-product/SPEC.md
- Макет: design/prototypes/Десктоп - Продать.dc.html · эталоны: design/screens/sell@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
