<?php

declare(strict_types=1);

// CSP script-src 'self' без nonce и unsafe-inline: в разметке страницы нет встроенных скриптов (1.1.6, ревью).
// Скрипт «Войти до гидратации» — статический файл public/js/pending-login.js.

it('в HTML страницы нет встроенных скриптов без nonce', function () {
    $html = $this->get('/')->assertOk()->getContent();

    preg_match_all('/<script\b([^>]*)>(.*?)<\/script>/is', (string) $html, $scripts, PREG_SET_ORDER);

    foreach ($scripts as [$tag, $attributes, $body]) {
        $external = preg_match('/\ssrc\s*=/i', $attributes) === 1;
        $nonce = preg_match('/\snonce\s*=/i', $attributes) === 1;

        expect($external || $nonce || trim($body) === '')
            ->toBeTrue("Встроенный скрипт без nonce: {$tag}");
    }
});

it('шаблон app.blade.php не содержит встроенных скриптов', function () {
    $template = (string) file_get_contents(resource_path('views/app.blade.php'));

    preg_match_all('/<script\b([^>]*)>/i', $template, $tags);

    foreach ($tags[1] as $attributes) {
        expect(preg_match('/\s(src|nonce)\s*=/i', ' '.$attributes))->toBe(1);
    }
});

it('скрипт до гидратации подключён файлом из public и лежит на диске', function () {
    $this->get('/')->assertOk()->assertSee('<script src="/js/pending-login.js"', false);

    expect(file_exists(public_path('js/pending-login.js')))->toBeTrue();
});
