# ЯМузыкант — стартовый пакет для агентной разработки MVP «Барахолка»

Пакет — корень будущего репозитория. В нём нет кода приложения: его создают агенты, начиная с задачи `0.1.1`. В пакете есть всё, что нужно, чтобы агент-оркестратор довёл MVP от пустого репозитория до релиза R1.

**MVP = Барахолка:** продажа б/у музыкальных инструментов частными продавцами. Вход через Яндекс ID и по коду на почту, подача объявления с фото, модерация (до G2 — публикация сразу после автопроверок), поиск по городу и фильтры, страница лота, чат с предложением цены, избранное, жалобы, консоль сотрудников. Новые товары от магазинов, мастера, тарифы, баллы, цены продаж и аксессуары — после MVP (`docs/00-product/SPEC.md §2`).

**Стек:** Laravel 12 + Inertia 2 (SSR) + React 18 + TypeScript, PostgreSQL 16, Meilisearch, Redis + Horizon, Reverb, S3 в РФ, Filament 3 для консоли сотрудников. Компоненты дизайн-системы — React, подключаются как есть (`docs/01-architecture/ARCHITECTURE.md`).

## Как запустить

1. Распакуйте архив в пустую папку.
2. Откройте её агентом (Claude Code) и дайте одну команду:
   ```
   Прочитай ORCHESTRATOR.md и выполни его целиком: этап 0 (GitHub), затем цикл задач до закрытия гейта G3.
   ```
3. Агент остановится и спросит вас только в точках из `ORCHESTRATOR.md §6`: секреты, подтверждение гейтов, юридические тексты, всё, что помечено «уточнить».

Нужно заранее: аккаунт GitHub и `gh` CLI с авторизацией, PHP 8.3, Composer, Node 22.22+, Docker (для PostgreSQL, Redis, Meilisearch), Playwright-браузеры (`npx playwright install`).

## Что внутри

```
README.md            этот файл
CLAUDE.md            точка входа агента → AGENTS.md
AGENTS.md            правила для всех агентов: SDD, TDD, роли, код, текст, дизайн
ORCHESTRATOR.md      протокол оркестратора: GitHub → цикл задач → гейты → релиз
docs/
  00-product/        SPEC.md (use cases, правила, жизненные циклы, данные), GLOSSARY.md
  01-architecture/   ARCHITECTURE.md (стек, модули, структура репозитория, интеграции)
  02-process/        SDD-TDD.md, MODELS.md, RELEASE-GATES.md, CI-CD.md, REVIEW.md
  03-design/         DESIGN-SYSTEM.md (правила ДС), SCREENS.md (экран → макет → состояния)
  ROADMAP.md         фазы, гейты, критический путь
  phases/ epics/ tasks/   иерархия фаза → эпик → задача (YAML frontmatter)
  operations/        status/ (генерируется), sessions/, templates/
design/
  prototypes/        кликабельные макеты *.dc.html (открываются в браузере через локальный сервер)
  screens/           manifest.json — экраны и состояния; PNG-эталоны создаёт задача 0.2.3
  ds/                исходники дизайн-системы: components/*.jsx|.d.ts|.prompt.md|.card.html, tokens/, docs/, ui_kits/
tools/               docs-ops.mjs, gh-sync.mjs, lint-copy.mjs, ds-sync.mjs, capture-reference.mjs
.github/             workflows (ci, deploy, release), шаблоны PR и задач, CODEOWNERS
```

## Источники истины

- **Что делать** — карточка задачи, затем `SPEC.md`.
- **Как выглядит** — дизайн-система (`design/ds`), затем прототип (`design/prototypes`). Если они расходятся, вид берётся из ДС, а текст и состав — из прототипа (`docs/03-design/DESIGN-SYSTEM.md §1`).
- **Готово ли** — критерии карточки + Definition of Done (`AGENTS.md §3`) + зелёный CI.
