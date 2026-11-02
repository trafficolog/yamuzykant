---
id: "5.3.1"
phase: "5"
epic: "5.3"
title: "Сотрудники: 2FA, роли, права"
status: todo
gate: G2
risk: high
model_impl: opus
model_review: opus
roles: ["BACK", "SEC"]
depends_on: ["0.2.5"]
uc: ["O5"]
prototype: "Админ - Сотрудники.dc.html"
screens: ["console-staff"]
issue: 48
sync_state: drifted
escalations: []
---

# 5.3.1. Сотрудники: 2FA, роли, права

## Цель
В консоль входят только сотрудники с 2FA, каждый видит свои разделы (BR-08).

## Что сделать
- TOTP 2FA (обязательна, без неё — только страница настройки), резервные коды
- Роли: moderator, support, admin; матрица «роль × раздел × действие» в сидере
- Ресурс «Сотрудники»: приглашение по e-mail, роль, отключение
- Сессии сотрудников 8 ч, повторный ввод 2FA для опасных действий

## Критерии приёмки
- [ ] Вход без 2FA невозможен (тест)
- [ ] Модератор не видит «Сотрудники» и «Справочники» (403 и нет в меню)
- [ ] Отключённый сотрудник выходит из всех сессий
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature: матрица прав — тест на каждую ячейку
- Pest: 2FA обязательна

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-O5 · docs/00-product/SPEC.md
- Макет: design/prototypes/Админ - Сотрудники.dc.html · эталоны: design/screens/console-staff@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
