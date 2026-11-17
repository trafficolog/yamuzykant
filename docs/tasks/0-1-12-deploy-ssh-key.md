---
id: "0.1.12"
phase: "0"
epic: "0.1"
title: "SSH-ключ деплоя и отключение входа по паролю на stage"
status: done
gate: G1
risk: high
model_impl: opus
model_review: opus
roles: ["DEVOPS", "SEC"]
depends_on: ["0.1.10"]
uc: []
prototype: ""
screens: []
issue: 95
sync_state: aligned
escalations: []
---

# 0.1.12. SSH-ключ деплоя и отключение входа по паролю на stage

## Цель
Выкатка на stage идёт по SSH-ключу, вход на сервер по паролю отключён (решение OWNER 03.11.2026: сервер новый, сейчас в секрете `DEPLOY_SSH_KEY` пароль).

## Что сделать
- **OWNER (вручную, на своём компьютере):** создать пару ключей ed25519 без хранения приватного ключа в репозитории; положить публичный ключ на сервер (`ssh-copy-id` — по паролю, один раз); приватный ключ — в секрет окружения `stage` `DEPLOY_SSH_KEY` вместо пароля; добавить секрет `DEPLOY_KNOWN_HOSTS` (отпечаток сервера). Приватный ключ не хранится в текстовом файле в репозитории и не передаётся в чат
- Отдельный пользователь деплоя (`DEPLOY_USER`, не root) с правами только на каталог приложения и перезапуск сервисов через sudoers
- Скрипт настройки sshd (часть provisioning из 0.1.4): `PasswordAuthentication no`, `PermitRootLogin no` (или `prohibit-password`), `KbdInteractiveAuthentication no`; перед применением — проверка, что вход по ключу работает (иначе не применять)
- Workflow выкатки проверяет `known_hosts` (`StrictHostKeyChecking yes`), без `ssh-keyscan` на лету

- Ручная проверка из PR #96 (0.1.4): протокол деплой → откат → повторный деплой с временем отката ≤ 1 мин; Nginx + PHP-FPM + basic-auth на сервере; certbot `--webroot`; `docker compose up --wait`; supervisor до первого релиза; `ufw --force enable` по живому SSH; память VPS на `npm ci && build:ssr`; `mc admin user add` из stdin
- Согласовать `DEPLOY_LOCK_WAIT` (900 с) и сборку с `timeout-minutes` deploy.yml (ревью PR #96)
- Порядок для OWNER: секреты → `provision.yml` (`provision`) → `STAGE_DEPLOY_LIVE=true` → мерж/перезапуск deploy.yml → `provision.yml` (`rollback`) → повторная выкатка

## Критерии приёмки
- [ ] Выкатка на stage из `deploy.yml` проходит по ключу (run)
- [ ] Вход на сервер по паролю отклоняется (`ssh -o PubkeyAuthentication=no` → Permission denied; вывод в PR)
- [x] Секрет `DEPLOY_SSH_KEY` содержит ключ, а не пароль (проверка в workflow: формат `-----BEGIN OPENSSH PRIVATE KEY-----`, без печати значения)
- [ ] Мерж в main → stage обновлён, `/health` 200 (перенесено из 0.1.4: без сервера не проверить)
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- workflow-guards: `StrictHostKeyChecking` не отключён, `known_hosts` из секрета
- Проверочный шаг формата ключа в deploy.yml

## Не делать
- Хранить ключи и пароли в репозитории, логах, артефактах

## Ссылки
- docs/02-process/CI-CD.md §5 · 0.1.4
