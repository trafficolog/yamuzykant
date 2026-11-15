<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>{{ __($done ? 'mail.unsubscribed.title' : 'mail.unsubscribe.title') }}</title>
    @vite('resources/css/app.css')
    <style>
        body { margin: 0; padding: var(--space-8) var(--space-4); background: var(--surface-recessed); color: var(--ink); font-family: var(--font-text); }
        main { max-width: 480px; margin: 0 auto; padding: var(--space-8); background: var(--surface-raised); border-radius: var(--radius-md); }
        h1 { margin: 0 0 var(--space-4); font-size: var(--text-xl); }
        p { margin: 0 0 var(--space-4); line-height: 1.5; }
        a { color: var(--accent-text); }
    </style>
</head>
<body>
<main>
    @if ($done)
        <h1>{{ __('mail.unsubscribed.title') }}</h1>
        <p>{{ __('mail.unsubscribed.'.$kind) }}</p>
        <p><a href="{{ route('account.profile') }}">{{ __('mail.unsubscribed.settings') }}</a></p>
    @else
        <h1>{{ __('mail.unsubscribe.'.$kind) }}</h1>
        {{-- POST на тот же подписанный URL: защищает подпись, CSRF-токен не нужен. --}}
        <form method="POST" action="{{ request()->fullUrl() }}">
            <button type="submit" class="ym-btn ym-btn--primary">{{ __('mail.unsubscribe.confirm') }}</button>
        </form>
    @endif
</main>
</body>
</html>
