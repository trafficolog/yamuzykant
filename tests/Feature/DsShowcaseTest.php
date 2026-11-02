<?php

declare(strict_types=1);

use Inertia\Testing\AssertableInertia as Assert;

it('отдаёт витрину /_ds в окружении testing при DS_SHOWCASE=true', function () {
    config(['app.ds_showcase' => true]);

    $this->get('/_ds')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Ds/Showcase'));
});

it('скрывает витрину /_ds в окружении testing без DS_SHOWCASE', function () {
    expect(config('app.ds_showcase'))->toBeFalse();

    $this->get('/_ds')->assertNotFound();
});

it('в production витрина всегда 404, даже при DS_SHOWCASE=true', function () {
    $this->app->detectEnvironment(fn () => 'production');
    config(['app.ds_showcase' => true]);

    $this->get('/_ds')->assertNotFound();
});

it('скрывает витрину /_ds при DS_SHOWCASE=false даже в окружении :dataset', function (string $environment) {
    $this->app->detectEnvironment(fn () => $environment);
    config(['app.ds_showcase' => false]);

    $this->get('/_ds')->assertNotFound();
})->with(['local', 'stage']);
