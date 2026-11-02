---
id: "0.1.1"
phase: "0"
epic: "0.1"
title: "Каркас Laravel + Inertia + React + SSR"
status: done
gate: G0
risk: medium
model_impl: sonnet
model_review: sonnet
roles: ["DEVOPS", "BACK", "FRONT"]
depends_on: []
uc: []
prototype: ""
screens: []
issue: 1
sync_state: aligned
escalations: []
---

# 0.1.1. Каркас Laravel + Inertia + React + SSR

## Цель
Пустое приложение Laravel 12 с Inertia 2, React 18, TypeScript и SSR, в корне репозитория рядом с docs/, design/, tools/.

## Что сделать
- `composer create-project laravel/laravel` во временную папку и перенос в корень без перезаписи docs/, design/, tools/, .github/, README.md, AGENTS.md, CLAUDE.md, ORCHESTRATOR.md
- Inertia 2 (server + `@inertiajs/react`), React 18, TypeScript strict, Vite, `ssr.tsx`, `php artisan inertia:start-ssr`
- Pint, Larastan 8, Pest 3, ESLint (typescript-eslint, react, jsx-a11y), Prettier, Vitest, Playwright — с конфигами
- `package.json` scripts: `dev`, `build`, `build:ssr`, `lint`, `typecheck`, `test:js`, `test:e2e`, `test:visual`, `lint:copy`, `ds:sync`, `docs:check`, `docs:refresh`, `docs:next`
- Структура каталогов из ARCHITECTURE.md §2 (пустые папки — с `.gitkeep`)
- Страница `/` — Inertia-страница `Home` с текстом «ЯМузыкант»; `/health` — JSON `{status:"ok"}`

## Критерии приёмки
- [ ] `composer test`, `npm run lint`, `npm run typecheck`, `npm run build && npm run build:ssr` проходят
- [ ] HTML ответа `/` содержит отрисованный на сервере текст «ЯМузыкант» (SSR работает)
- [ ] `/health` отвечает 200 за ≤ 50 мс локально
- [ ] Файлы стартового пакета не изменены (кроме добавления scripts)
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature: GET / → 200 и SSR-разметка
- Pest feature: GET /health
- Pest arch: `app/Domain` не зависит от `App\Http`
- Playwright smoke: открывается /, нет ошибок консоли

## Не делать
- Не добавлять Breeze/Jetstream — вход делается в 1.1.1

## Ссылки
- SPEC: — · docs/00-product/SPEC.md

