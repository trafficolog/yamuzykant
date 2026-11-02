<?php

declare(strict_types=1);

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

it('отдаёт главную как Inertia-страницу Home', function () {
    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Home'));
});

it('вставляет SSR-разметку с названием «ЯМузыкант» в HTML ответа', function () {
    config(['inertia.ssr.enabled' => true, 'inertia.ssr.ensure_bundle_exists' => false]);

    Http::fake([
        '*/render' => Http::response([
            'head' => ['<title>ЯМузыкант</title>'],
            'body' => '<div id="app"><h1>ЯМузыкант</h1></div>',
        ]),
    ]);

    $this->get('/')
        ->assertOk()
        ->assertSee('<div id="app"><h1>ЯМузыкант</h1></div>', false)
        ->assertSee('<title>ЯМузыкант</title>', false);

    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/render')
        && $request['component'] === 'Home');
});

it('без SSR-сервера отдаёт страницу с клиентским рендером, а не падает', function () {
    config(['inertia.ssr.enabled' => true, 'inertia.ssr.ensure_bundle_exists' => false]);

    Http::fake(['*/render' => Http::response('', 500)]);

    $this->get('/')->assertOk();
});
