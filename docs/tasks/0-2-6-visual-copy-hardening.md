---
id: "0.2.6"
phase: "0"
epic: "0.2"
title: "Визуальные и текстовые проверки: укрепление после ревью"
status: review
gate: G1
risk: low
model_impl: sonnet
model_review: sonnet
roles: ["QA", "FRONT"]
depends_on: ["0.2.2", "0.2.3"]
uc: []
prototype: ""
screens: []
issue: 78
sync_state: drifted
escalations: []
---

# 0.2.6. Визуальные и текстовые проверки: укрепление после ревью

## Цель
Визуальные тесты детерминированы, а проверка текстов видит атрибуты (неблокирующие замечания ревью PR #73 и #75).

## Что сделать
- `openPrototype` / съёмка эталонов: отключить анимации и переходы (`addInitScript` или `reducedMotion`), дождаться шрифтов
- Маски `[data-dynamic]` закрашивать и при съёмке эталона (`tools/capture-reference.mjs`), либо описать ограничение в `design/screens/README.md`
- `playwright`, `@playwright/test`, `http-server` — точные версии
- Порог визуального сравнения не «разбавляется» пустым полем (аудит G0, R5): снимок блока (локатор) вместо всей страницы для header/footer, либо порог в пикселях
- Шрифты (ревью PR #84): тест сверяет `href` preload с реальным `@font-face`; e2e проверяет загрузку JetBrains Mono 500
- `copy.spec.ts`: кроме `innerText` проверять `title`, `placeholder`, `aria-label`, `alt`

## Критерии приёмки
- [ ] 5 подряд прогонов `npm run test:visual` в контейнере CI без ретраев — 0 флаков (`retries: 0` для проекта references)
- [ ] Запрещённое слово в `placeholder` или `aria-label` роняет `copy.spec.ts` (контрольный тест)
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Контрольный тест copy.spec на атрибутах
- Повторный прогон самосравнения footer@1440 с `maxDiffPixels: 0` и `retries: 0`

## Не делать
- Пересъёмка эталонов без причины (только если отключение анимаций меняет кадр — отдельным коммитом с объяснением)

## Ссылки
- PR #73, PR #75 (комментарии ревьюеров) · design/screens/README.md
