<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        {{-- request_id этого ответа: фронтовые события Sentry получают тот же тег, что и серверные (0.1.14). --}}
        <meta name="request-id" content="{{ request()->headers->get('X-Request-Id') }}">
        @if (config('app.noindex'))
            <meta name="robots" content="noindex, nofollow">
        @endif
        <title inertia>{{ config('app.name') }}</title>
        {{-- Основное начертание: Onest (кириллица и латиница — цифры и пробел). Остальные подмножества грузятся по unicode-range. --}}
        <link rel="preload" href="/fonts/onest-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
        <link rel="preload" href="/fonts/onest-latin.woff2" as="font" type="font/woff2" crossorigin>
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        @inertiaHead
    </head>
    <body>
        {{-- Клик по «Войти» до гидратации запоминаем: окно откроется, когда страница оживёт (LoginDialogHost). Статический файл — CSP script-src 'self'. --}}
        <script src="/js/pending-login.js"></script>
        @inertia
    </body>
</html>
