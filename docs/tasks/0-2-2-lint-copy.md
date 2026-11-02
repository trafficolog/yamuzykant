---
id: "0.2.2"
phase: "0"
epic: "0.2"
title: "Проверка текстов: lint:copy и copy.spec"
status: todo
gate: G0
risk: low
model_impl: haiku
model_review: sonnet
roles: ["FRONT"]
depends_on: ["0.1.1"]
uc: []
prototype: ""
screens: []
issue: null
sync_state: drifted
escalations: []
---

# 0.2.2. Проверка текстов: lint:copy и copy.spec

## Цель
Запрещённые слова и сырые цвета не попадают в интерфейс.

## Что сделать
- Довести `tools/lint-copy.mjs`: словарь из AGENTS.md §5, режим `--styles` (hex/rgb в Pages, Components, Layouts)
- Подключить в job `docs` и в `npm run lint:copy`
- Playwright `copy.spec.ts`: обход всех публичных маршрутов, проверка `document.body.innerText`

## Критерии приёмки
- [ ] Слово «сетап» в .tsx, .php, lang/*.php роняет CI с файлом и строкой
- [ ] `#fff` в Pages/*.tsx роняет `--styles`
- [ ] Исключение — только комментарий `copy-allow: причина` на строке
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Node test (`node --test`): фикстуры с нарушениями и без

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: — · docs/00-product/SPEC.md

