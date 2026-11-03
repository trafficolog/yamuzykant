<?php

declare(strict_types=1);

use App\Http\Controllers\Auth\EmailLoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\RegistrationController;
use App\Http\Controllers\Catalog\SuggestModelController;
use App\Http\Controllers\DsShowcaseController;
use App\Http\Controllers\HomeController;
use Illuminate\Support\Facades\Route;

Route::get('/', HomeController::class)->name('home');

// Предложение модели — с сессией и CSRF (группа web), поэтому маршрут здесь, а не в api.php.
Route::post('/api/models/suggestions', SuggestModelController::class)
    ->middleware(['auth', 'throttle:30,1'])
    ->name('api.models.suggest');

// Витрина дизайн-системы: контроллер отвечает 404 вне окружений local и stage.
Route::get('/_ds', DsShowcaseController::class)->name('ds.showcase');

// Вход по коду на почту (1.1.1). Лимиты — в домене (LoginThrottle), ответы — JSON для окна входа.
Route::prefix('auth')->name('auth.')->group(function (): void {
    Route::middleware('guest')->group(function (): void {
        Route::post('email/code', [EmailLoginController::class, 'sendCode'])->name('email.code');
        Route::post('email/verify', [EmailLoginController::class, 'verify'])->name('email.verify');
        Route::post('register', RegistrationController::class)->name('register');
    });

    Route::middleware('auth')->group(function (): void {
        Route::post('logout', [LogoutController::class, 'logout'])->name('logout');
        Route::post('logout-everywhere', [LogoutController::class, 'everywhere'])->name('logout-everywhere');
    });
});
