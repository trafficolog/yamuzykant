---
id: "6.2.2"
phase: "6"
epic: "6.2"
title: "Бюджет производительности"
status: todo
gate: G3
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["FRONT", "BACK"]
depends_on: ["3.1.4", "3.1.5", "3.1.2"]
uc: []
prototype: ""
screens: []
issue: null
sync_state: drifted
escalations: []
---

# 6.2.2. Бюджет производительности

## Цель
Ключевые страницы быстрые на мобильном интернете (SPEC §9).

## Что сделать
- Lighthouse CI в job e2e: главная, Барахолка, лот (мобильный профиль)
- Изображения: srcset, lazy, размеры; шрифты: preload, font-display swap
- Кэш: HTTP для статики, Redis для тяжёлых props, N+1 — `preventLazyLoading`

## Критерии приёмки
- [ ] LCP ≤ 2,5 с, CLS ≤ 0,1, TBT ≤ 200 мс в Lighthouse CI
- [ ] Ни одного N+1 в тестах (lazy loading запрещён в testing)
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Lighthouse CI assertions
- Pest: Model::preventLazyLoading

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: — · docs/00-product/SPEC.md

