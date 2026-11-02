---
id: "5.2.2"
phase: "5"
epic: "5.2"
title: "Помощь и обращение в поддержку"
status: todo
gate: G2
risk: low
model_impl: haiku
model_review: sonnet
roles: ["FRONT", "BACK"]
depends_on: ["0.2.4"]
uc: ["H1"]
prototype: "Десктоп - Помощь.dc.html"
screens: ["help"]
issue: null
sync_state: drifted
escalations: []
---

# 5.2.2. Помощь и обращение в поддержку

## Цель
Ответы на частые вопросы и форма обращения.

## Что сделать
- help_articles (раздел, заголовок, тело Markdown) — редактируются в консоли
- Страницы: разделы, статья, поиск по статьям, форма «Написать в поддержку» → ticket
- Тексты статей — от OWNER (уточнить); до этого — из макета

## Критерии приёмки
- [ ] Страница в пороге эталона `help`
- [ ] Обращение создаёт ticket и письмо-подтверждение
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Playwright visual: help
- Playwright UC-H1.spec.ts

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-H1 · docs/00-product/SPEC.md
- Макет: design/prototypes/Десктоп - Помощь.dc.html · эталоны: design/screens/help@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
