---
id: "0.1"
phase: "0"
title: "Репозиторий, окружения, CI/CD"
status: in_progress
gate: G0
---

# Эпик 0.1. Репозиторий, окружения, CI/CD

**Use cases:** — · **Макеты:** —
**Зависит от эпиков:** —

## Задачи

<!-- docs:ops:begin tasks -->
| Задача | Статус | Риск | Исполнитель → Ревьюер |
|---|---|---|---|
| [0.1.1 Каркас Laravel + Inertia + React + SSR](../tasks/0-1-1-laravel-skeleton.md) | done | medium | sonnet → sonnet |
| [0.1.2 Локальное окружение Docker Compose](../tasks/0-1-2-docker-local.md) | done | low | haiku → sonnet |
| [0.1.3 CI на GitHub Actions](../tasks/0-1-3-ci.md) | done | high | opus → opus |
| [0.1.4 Окружение stage и автодеплой](../tasks/0-1-4-stage-deploy.md) | done | high | opus → opus |
| [0.1.5 Логи, ошибки, health](../tasks/0-1-5-observability.md) | todo | medium | sonnet → sonnet |
| [0.1.6 Фича-флаги Pennant](../tasks/0-1-6-feature-flags.md) | done | low | haiku → sonnet |
| [0.1.7 Larastan для tests/ и config/](../tasks/0-1-7-larastan-tests.md) | done | low | haiku → sonnet |
| [0.1.8 CI и docs-ops: укрепление после ревью](../tasks/0-1-8-ci-hardening.md) | done | medium | sonnet → opus |
| [0.1.9 Флаги и тестовый каркас: доработки после ревью](../tasks/0-1-9-flags-test-harness.md) | done | low | haiku → sonnet |
| [0.1.10 Защита release.yml и deploy.yml без branch protection](../tasks/0-1-10-workflow-guards.md) | done | high | opus → opus |
| [0.1.11 GitHub Actions: переход на актуальные мажорные версии](../tasks/0-1-11-actions-major-update.md) | todo | low | haiku → sonnet |
| [0.1.12 SSH-ключ деплоя и отключение входа по паролю на stage](../tasks/0-1-12-deploy-ssh-key.md) | todo | high | opus → opus |
| [0.1.13 Content-Security-Policy с nonce для Inertia и SSR](../tasks/0-1-13-csp.md) | todo | medium | sonnet → opus |
<!-- docs:ops:end -->
