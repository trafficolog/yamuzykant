<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <title inertia>{{ config('app.name') }}</title>
        {{-- Основное начертание: Onest (кириллица и латиница — цифры и пробел). Остальные подмножества грузятся по unicode-range. --}}
        <link rel="preload" href="/fonts/onest-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
        <link rel="preload" href="/fonts/onest-latin.woff2" as="font" type="font/woff2" crossorigin>
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        @inertiaHead
    </head>
    <body>
        {{-- Клик по «Войти» до гидратации (JS-бандл ещё грузится) запоминаем: окно откроется, когда страница оживёт (LoginDialogHost). --}}
        <script>
            document.addEventListener('click', function (event) {
                var target = event.target;
                if (document.documentElement.dataset.hydrated === 'true' || !(target instanceof Element)) return;
                if (target.closest('[data-login-trigger]')) {
                    event.preventDefault();
                    window.__ymLoginPending = true;
                }
            });
        </script>
        @inertia
    </body>
</html>
