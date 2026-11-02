<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

/**
 * Витрина дизайн-системы /_ds: все компоненты `@ds` со всеми вариантами.
 * Включается конфигом app.ds_showcase (DS_SHOWCASE; по умолчанию local и stage),
 * в production всегда отвечает 404.
 */
final class DsShowcaseController extends Controller
{
    public function __invoke(): Response
    {
        abort_unless(config('app.ds_showcase') === true && ! app()->environment('production'), 404);

        return Inertia::render('Ds/Showcase');
    }
}
