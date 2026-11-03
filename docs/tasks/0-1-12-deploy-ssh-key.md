---
id: "0.1.12"
phase: "0"
epic: "0.1"
title: "SSH-ключ деплоя и отключение входа по паролю на stage"
status: todo
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
sync_state: drifted
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

## Критерии приёмки
- [ ] Выкатка на stage из `deploy.yml` проходит по ключу (run)
- [ ] Вход на сервер по паролю отклоняется (`ssh -o PubkeyAuthentication=no` → Permission denied; вывод в PR)
- [ ] Секрет `DEPLOY_SSH_KEY` содержит ключ, а не пароль (проверка в workflow: формат `-----BEGIN OPENSSH PRIVATE KEY-----`, без печати значения)
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- workflow-guards: `StrictHostKeyChecking` не отключён, `known_hosts` из секрета
- Проверочный шаг формата ключа в deploy.yml

## Не делать
- Хранить ключи и пароли в репозитории, логах, артефактах

## Ссылки
- docs/02-process/CI-CD.md §5 · 0.1.4
