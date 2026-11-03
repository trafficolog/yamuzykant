<?php

declare(strict_types=1);

use App\Http\Controllers\Catalog\SuggestModelController;
use App\Http\Controllers\DsShowcaseController;
use App\Http\Controllers\HomeController;
use Illuminate\Support\Facades\Route;

Route::get('/', HomeController::class)->name('home');

// Предложение модели — с сессией и CSRF (группа web), поэтому маршрут здесь, а не в api.php.
Route::post('/api/models/suggestions', SuggestModelController::class)
    ->middleware(['auth', 'throttle:10,1'])
    ->name('api.models.suggest');

// Витрина дизайн-системы: контроллер отвечает 404 вне окружений local и stage.
Route::get('/_ds', DsShowcaseController::class)->name('ds.showcase');
