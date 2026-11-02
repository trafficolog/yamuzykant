---
id: "2.1.2"
phase: "2"
epic: "2.1"
title: "Загрузка и обработка фото"
status: todo
gate: G1
risk: high
model_impl: opus
model_review: opus
roles: ["BACK", "FRONT", "SEC"]
depends_on: ["2.1.1", "0.1.2"]
uc: ["L1"]
prototype: "Десктоп - Продать.dc.html"
screens: []
issue: 21
sync_state: drifted
escalations: []
---

# 2.1.2. Загрузка и обработка фото

## Цель
Фото загружаются быстро, безопасно и отдаются в нужных размерах (BR-03).

## Что сделать
- Прямая загрузка в S3 по presigned URL, подтверждение на бэкенде
- Проверка MIME по содержимому, ≤ 15 МБ, HEIC → JPEG
- Job: перекодирование 1:1 и 4:3 (WebP + AVIF), удаление EXIF, perceptual hash
- `Components/PhotoUploader`: 6 ячеек из макета (первая — серийный номер), drag-and-drop, порядок, удаление, прогресс, ошибка

## Критерии приёмки
- [ ] Файл с GPS в EXIF — в отдаваемых версиях EXIF нет
- [ ] PDF с расширением .jpg отклоняется
- [ ] Фото 12 Мп готово к показу ≤ 10 с
- [ ] Ячейка «Серийный номер» отмечена «обязательно»
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature: presign, confirm, отказ по MIME и размеру
- Pest: job на фикстуре с EXIF GPS
- Vitest: PhotoUploader состояния
- Playwright: загрузка 3 фото

## Не делать
- Выходить за объём карточки

## Ссылки
- SPEC: UC-L1 · docs/00-product/SPEC.md
- Макет: design/prototypes/Десктоп - Продать.dc.html
- Правила ДС: docs/03-design/DESIGN-SYSTEM.md
