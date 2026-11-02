---
id: "0.2.3"
phase: "0"
epic: "0.2"
title: "Эталоны макетов и визуальные тесты"
status: todo
gate: G0
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["FRONT"]
depends_on: ["0.2.1"]
uc: []
prototype: "Все из manifest.json"
screens: ["*"]
issue: 9
sync_state: drifted
escalations: []
---

# 0.2.3. Эталоны макетов и визуальные тесты

## Цель
Для каждого экрана MVP есть PNG-эталон 1440 и 390 и работающий визуальный тест-каркас.

## Что сделать
- `npm i -D playwright http-server`; довести `tools/capture-reference.mjs`
- Снять эталоны: `npx http-server design/prototypes -p 8123` + `node tools/capture-reference.mjs` → `design/screens/*.png`
- Проверить глазами каждый снимок: экран отрисован полностью, нет пустых областей и ошибок загрузки
- `tests/e2e/visual/_helpers.ts`: сравнение страницы реализации с эталоном по manifest (порог, маски)
- Тест-заготовки `visual/{id}.spec.ts` со `test.fixme` для экранов следующих гейтов

## Критерии приёмки
- [ ] В `design/screens` есть PNG для каждого `screens[].viewports` из manifest
- [ ] Снимки не пустые (размер > 30 КБ, высота > 900 px)
- [ ] Хелпер падает с diff-изображением в артефактах при превышении порога
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Playwright: хелпер на эталоне `footer` против прототипа (самосравнение = 0)

## Не делать
- Не перегенерировать эталоны в других задачах

## Ссылки
- SPEC: — · docs/00-product/SPEC.md
- Макет: design/prototypes/Все из manifest.json · эталоны: все
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
