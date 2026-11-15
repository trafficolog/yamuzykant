<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>{{ __('mail.unsubscribed.title') }}</title>
    <style>
        body { margin: 0; padding: 48px 16px; background: #f2f3f5; color: #15171a; font-family: Onest, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
        main { max-width: 480px; margin: 0 auto; padding: 32px; background: #fff; border-radius: 8px; }
        h1 { margin: 0 0 16px; font-size: 22px; }
        p { margin: 0 0 16px; line-height: 1.5; }
        a { color: #0a7543; }
    </style>
</head>
<body>
<main>
    <h1>{{ __('mail.unsubscribed.title') }}</h1>
    <p>{{ __('mail.unsubscribed.'.$kind) }}</p>
    <p><a href="{{ route('account.profile') }}">{{ __('mail.unsubscribed.settings') }}</a></p>
</main>
</body>
</html>
