<?php

declare(strict_types=1);

use App\Http\Controllers\Catalog\ModelSearchController;
use Illuminate\Support\Facades\Route;

// Подсказка моделей: публично, лимит 60 запросов в минуту с IP.
Route::get('/models', ModelSearchController::class)
    ->middleware('throttle:60,1')
    ->name('api.models.search');
