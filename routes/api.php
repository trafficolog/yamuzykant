<?php

declare(strict_types=1);

use App\Http\Controllers\Catalog\ModelSearchController;
use Illuminate\Support\Facades\Route;

// Подсказка моделей: публично; общий лимит /api (throttle:api) по IP.
Route::get('/models', ModelSearchController::class)->name('api.models.search');
