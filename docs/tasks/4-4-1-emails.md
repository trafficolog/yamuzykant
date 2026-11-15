---
id: "4.4.1"
phase: "4"
epic: "4.4"
title: "Письма: шаблон, код входа, новое сообщение"
status: done
gate: G1
risk: low
model_impl: haiku
model_review: sonnet
roles: ["BACK"]
depends_on: ["1.1.3", "4.1.1"]
uc: ["N1"]
prototype: "Письма и уведомления.dc.html"
screens: ["emails"]
issue: 40
sync_state: aligned
escalations: []
---

# 4.4.1. Письма

## Цель
Письма по шаблонам макета.

## Что сделать
- Markdown-шаблоны Laravel с темой ДС: Wordmark 20 px, accent, Onest с фолбэком
- Письма в G1: код входа (перевод `LoginCodeMail` из 1.1.1 на тему ДС), новое сообщение (не чаще 1 раза в 15 мин на чат, только если собеседник не в сети)
- Письма модерации, предложения цены и сохранённого поиска делают 5.1.3, 4.2.1 и 4.3.2 на этом шаблоне
- Ссылка отписки в каждом, кроме служебных

## Критерии приёмки
- [ ] Письма login-code и new-message совпадают по составу с макетом (снимок из Mailpit в PR)
- [ ] Отписка работает в один клик
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest: рендер каждого Mailable со снимком (assertSeeInOrder)

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-N1 · docs/00-product/SPEC.md
- Макет: design/prototypes/Письма и уведомления.dc.html · эталоны: design/screens/emails@{1440,390}.png
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
