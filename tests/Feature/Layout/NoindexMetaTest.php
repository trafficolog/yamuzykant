<?php

declare(strict_types=1);

// 0.1.12: stage закрыт от индексации. Флаг APP_NOINDEX (config app.noindex) включает meta robots
// на всех страницах; в production его нет, чтобы поисковики видели сайт.
it('по умолчанию флаг noindex выключен', function () {
    expect(config('app.noindex'))->toBeFalse();
});

it('при app.noindex=true страница отдаёт meta robots noindex, nofollow', function () {
    config(['app.noindex' => true]);

    $this->get('/')
        ->assertOk()
        ->assertSee('<meta name="robots" content="noindex, nofollow">', false);
});

it('без флага meta robots на странице нет', function () {
    config(['app.noindex' => false]);

    $this->get('/')
        ->assertOk()
        ->assertDontSee('name="robots"', false);
});
