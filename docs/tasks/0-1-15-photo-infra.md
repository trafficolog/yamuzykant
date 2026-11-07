---
id: "0.1.15"
phase: "0"
epic: "0.1"
title: "Инфраструктура фото: S3 для stage, HEIC и AVIF на сервере, очистка загрузок"
status: todo
gate: G1
risk: medium
model_impl: sonnet
model_review: opus
roles: ["DEVOPS", "BACK"]
depends_on: ["2.1.2", "0.1.12"]
uc: ["L1"]
prototype: ""
screens: []
issue: 111
sync_state: drifted
escalations: ["Хранилище фото для stage и production: внешнее S3 (Yandex Object Storage / VK Cloud) или MinIO наружу — решение OWNER на G1"]
---

# 0.1.15. Инфраструктура фото: S3 для stage, HEIC и AVIF на сервере, очистка загрузок

## Цель
Загрузка фото работает на stage так же, как в тестах: прямая загрузка в S3, HEIC с iPhone конвертируется, AVIF создаётся, брошенные загрузки удаляются (вопросы и замечания ревью PR #109).

## Что сделать
- Хранилище: по решению OWNER — внешнее S3 или MinIO за Nginx с TLS; CORS бакета для PUT с домена stage; переменные — в `.env.example`, ARCHITECTURE §9, секреты stage (вводит OWNER)
- `deploy/provision.sh`: `php8.3-imagick` с libheif (HEIC), проверка поддержки AVIF и WebP в GD; без поддержки — понятная ошибка провижининга
- Брошенные загрузки: lifecycle-правило бакета на префикс `uploads/` (24 ч) или задача в scheduler; тест на задачу
- Smoke на stage: загрузка 3 фото, в том числе HEIC, через окно «Продать» или служебный сценарий; результат — в файл сессии

## Критерии приёмки
- [ ] На stage фото загружается по presigned PUT, версии WebP и AVIF создаются, EXIF нет
- [ ] HEIC с iPhone на stage конвертируется
- [ ] Неподтверждённая загрузка старше 24 ч удаляется
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest: очистка брошенных загрузок; deploy-тесты provision (наличие пакетов)

## Не делать
- CDN — после R1

## Ссылки
- PR #109 (комментарий ревьюера, п. 6, 10) · ARCHITECTURE §9 · docs/02-process/CI-CD.md §5
