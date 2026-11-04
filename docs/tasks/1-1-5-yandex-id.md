---
id: "1.1.5"
phase: "1"
epic: "1.1"
title: "Вход через Яндекс ID: бэкенд"
status: review
gate: G1
risk: high
model_impl: opus
model_review: opus
roles: ["BACK", "SEC"]
depends_on: ["1.1.1"]
uc: ["A1"]
prototype: ""
screens: []
issue: 17
sync_state: drifted
escalations: []
---

# 1.1.5. Вход через Яндекс ID: бэкенд

## Цель
Пользователь входит одной кнопкой через Яндекс ID; аккаунт тот же, что при входе по почте (SPEC UC-A1).

## Что сделать
- Laravel Socialite + `socialiteproviders/yandex` (новая зависимость — запись в PR); scopes: `login:email`, `login:info`
- `GET /auth/yandex/redirect`, `GET /auth/yandex/callback`; `state` и PKCE; адрес возврата к действию хранится в сессии, только относительные пути
- Привязка: найден `yandex_id` → вход; иначе найден пользователь с той же почтой (`default_email`) → записать `yandex_id` и войти; иначе — первый вход через `CompleteLogin` из 1.1.1 с именем из Яндекса
- Яндекс не отдал почту → шаг «Введите почту» с подтверждением кодом (1.1.1)
- Отказ или ошибка у Яндекса → возврат в окно входа с текстом «Вход через Яндекс ID отменён. Войдите по почте или попробуйте ещё раз»
- Токены Яндекса не хранить; храним только `yandex_id`
- Переменные `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`, `YANDEX_REDIRECT_URI` — в `.env.example` и ARCHITECTURE §9; значения — GitHub Secrets (вводит OWNER)
- Для CI и e2e — `YANDEX_OAUTH_FAKE`: подменный провайдер, который отдаёт тестового пользователя; работает только в окружениях из закрытого списка `testing` и `e2e`

## Критерии приёмки
- [ ] Вход через Яндекс ID пользователя, который уже входил по той же почте, не создаёт второй аккаунт
- [ ] Неверный или повторно использованный `state` → 403, без входа
- [ ] Открытый редирект невозможен: внешний адрес возврата заменяется на главную
- [ ] `yandex_id` и почта не уходят на фронт других пользователей
- [ ] Definition of Done — AGENTS.md §3

## Тесты (пишутся первыми)
- Pest feature (Socialite::fake / Http::fake): новый пользователь, привязка по почте, вход по `yandex_id`, нет почты, отказ, неверный state
- Pest: `YANDEX_OAUTH_FAKE` не действует при APP_ENV `local`, `stage`, `production`

## Не делать
- Не делать другие соцсети и вход по телефону
- Не делать отвязку Яндекс ID в профиле (уточнить, отдельная карточка)

## Ссылки
- SPEC: UC-A1 · docs/00-product/SPEC.md · ARCHITECTURE §7
