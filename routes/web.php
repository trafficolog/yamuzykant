<?php

declare(strict_types=1);

use App\Http\Controllers\Auth\EmailLoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\RegistrationController;
use App\Http\Controllers\Catalog\SuggestModelController;
use App\Http\Controllers\CityController;
use App\Http\Controllers\Dev\PhotoUploaderPlaygroundController;
use App\Http\Controllers\DsShowcaseController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\Listings\ListingPhotoController;
use App\Http\Controllers\Listings\LocalPhotoUploadController;
use App\Http\Controllers\Listings\PhotoMediaController;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Support\Facades\Route;

Route::get('/', HomeController::class)->name('home');

// Предложение модели — с сессией и CSRF (группа web), поэтому маршрут здесь, а не в api.php.
Route::post('/api/models/suggestions', SuggestModelController::class)
    ->middleware(['auth', 'throttle:30,1'])
    ->name('api.models.suggest');

// Город шапки (UC-S1): смена — 30 запросов в минуту с одного адреса; справочник для окна выбора — 60 в минуту.
Route::post('/city', [CityController::class, 'update'])->middleware('throttle:30,1')->name('city.update');
Route::get('/cities', [CityController::class, 'search'])->middleware('throttle:60,1')->name('cities.search');

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

// Фото объявления (2.1.2): URL загрузки, подтверждение, порядок, удаление — для владельца (ListingPolicy::update).
Route::middleware('auth')->prefix('listings/{listing}/photos')->name('listings.photos.')->scopeBindings()->group(function (): void {
    Route::get('/', [ListingPhotoController::class, 'index'])->name('index');
    Route::post('uploads', [ListingPhotoController::class, 'requestUpload'])->middleware('throttle:60,1')->name('uploads');
    Route::post('/', [ListingPhotoController::class, 'store'])->middleware('throttle:60,1')->name('store');
    Route::put('order', [ListingPhotoController::class, 'reorder'])->name('order');
    Route::delete('{photo}', [ListingPhotoController::class, 'destroy'])->name('destroy');
});

// Отдаваемые версии фото: приложение отдаёт файл из закрытого бакета с правами объявления (MinIO наружу не открыт).
Route::get('/media/photos/{photo}/{variant}.{format}', PhotoMediaController::class)
    ->where(['photo' => '[0-9]+', 'variant' => '[a-z]+', 'format' => '[a-z]+'])
    ->name('photos.media');

// Приёмник загрузки без S3 (тесты, e2e): только по подписанному URL; при S3 — 404. CSRF не нужен — доступ даёт подпись.
Route::put('/_uploads/photos', LocalPhotoUploadController::class)
    ->middleware('signed')
    ->withoutMiddleware(ValidateCsrfToken::class)
    ->name('photos.upload.local');

// Служебная страница загрузчика для e2e до формы «Продать» (2.1.3): только local, testing, e2e.
Route::get('/_e2e/photo-uploader', PhotoUploaderPlaygroundController::class)->middleware('auth')->name('e2e.photo-uploader');
