---
id: "6.4.1"
phase: "6"
epic: "6.4"
title: "Production и release.yml"
status: todo
gate: G3
risk: high
model_impl: opus
model_review: opus
roles: ["DEVOPS"]
depends_on: ["0.1.4", "6.3.3"]
uc: []
prototype: ""
screens: []
issue: null
sync_state: drifted
escalations: []
---

# 6.4.1. Production и release.yml

## Цель
Production развёрнут, выкатка — только тегом с подтверждением OWNER.

## Что сделать
- Окружение по образцу stage, отдельные ресурсы и секреты; домен (уточнить)
- `release.yml`: тег v* → сборка → environment production (ревьюер OWNER) → deploy → GitHub Release с примечаниями
- Поэтапное включение `r1_public`: 10 → 50 → 100 %

## Критерии приёмки
- [ ] Тег без подтверждения OWNER не выкатывается
- [ ] Откат релиза ≤ 2 мин
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Пробный релиз `v0.9.0-rc.1` на production с закрытым доступом — протокол

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: — · docs/00-product/SPEC.md

