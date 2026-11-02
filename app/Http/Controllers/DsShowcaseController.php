<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

/**
 * Витрина дизайн-системы /_ds: все компоненты `@ds` со всеми вариантами.
 * Доступна только в окружениях local и stage, в остальных отвечает 404.
 */
final class DsShowcaseController extends Controller
{
    public function __invoke(): Response
    {
        abort_unless(app()->environment(['local', 'stage']), 404);

        return Inertia::render('Ds/Showcase');
    }
}
