<?php

declare(strict_types=1);

use Inertia\Testing\AssertableInertia as Assert;

it('отдаёт витрину дизайн-системы /_ds в окружении :dataset', function (string $environment) {
    $this->app->detectEnvironment(fn () => $environment);

    $this->get('/_ds')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Ds/Showcase'));
})->with(['local', 'stage']);

it('скрывает витрину /_ds в окружении :dataset', function (string $environment) {
    $this->app->detectEnvironment(fn () => $environment);

    $this->get('/_ds')->assertNotFound();
})->with(['production', 'testing', 'ci']);
