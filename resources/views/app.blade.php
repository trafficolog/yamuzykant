<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title inertia>{{ config('app.name') }}</title>
        {{-- Основное начертание: Onest (кириллица и латиница — цифры и пробел). Остальные подмножества грузятся по unicode-range. --}}
        <link rel="preload" href="/fonts/onest-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
        <link rel="preload" href="/fonts/onest-latin.woff2" as="font" type="font/woff2" crossorigin>
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        @inertiaHead
    </head>
    <body>
        @inertia
    </body>
</html>
