<?php

declare(strict_types=1);

use App\Http\Controllers\Auth\EmailLoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\RegistrationController;
use App\Http\Controllers\Auth\YandexEmailController;
use App\Http\Controllers\Auth\YandexLoginController;
use App\Http\Controllers\Catalog\SuggestModelController;
use App\Http\Controllers\CityController;
use App\Http\Controllers\Dev\MessagingPlaygroundController;
use App\Http\Controllers\Dev\PhotoUploaderPlaygroundController;
use App\Http\Controllers\DsShowcaseController;
use App\Http\Controllers\FleaController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\Listings\ListingPhotoController;
use App\Http\Controllers\Listings\LocalPhotoUploadController;
use App\Http\Controllers\Listings\PhotoMediaController;
use App\Http\Controllers\Listings\SellController;
use App\Http\Controllers\Messaging\ConversationController;
use App\Http\Controllers\Messaging\MessagesPageController;
use App\Http\Middleware\EnsureE2eEnvironment;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Support\Facades\Route;

Route::get('/', HomeController::class)->name('home');

// Барахолка (3.1.2): выдача города шапки; категория — путь из слагов, неизвестная даёт 404 в контроллере.
Route::get('/baraholka/{path?}', FleaController::class)
    ->where('path', '[A-Za-z0-9\-]+(/[A-Za-z0-9\-]+)*')
    ->name('flea');

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

        // Вход через Яндекс ID (1.1.5). Лимиты неверных кодов на него не действуют; шаг «Введите почту» —
        // код 1.1.1 с его лимитами. throttle — только от перебора callback (каждый — запрос к Яндексу).
        Route::middleware('throttle:30,1')->group(function (): void {
            Route::get('yandex/redirect', [YandexLoginController::class, 'redirect'])->name('yandex.redirect');
            Route::get('yandex/callback', [YandexLoginController::class, 'callback'])->name('yandex.callback');
        });
        Route::post('yandex/email/code', [YandexEmailController::class, 'sendCode'])->name('yandex.email.code');
        Route::post('yandex/email/verify', [YandexEmailController::class, 'verify'])->name('yandex.email.verify');
    });

    Route::middleware('auth')->group(function (): void {
        Route::post('logout', [LogoutController::class, 'logout'])->name('logout');
        Route::post('logout-everywhere', [LogoutController::class, 'everywhere'])->name('logout-everywhere');
    });
});

// Форма «Продать инструмент» (2.1.3): страница с черновиком и проверка содержимого. Гость — на главную, вход — окно.
Route::middleware('auth')->group(function (): void {
    Route::get('/sell', [SellController::class, 'create'])->name('sell');
    Route::post('/sell', [SellController::class, 'store'])->middleware('throttle:60,1')->name('sell.store');
});

// Фото объявления (2.1.2): URL загрузки, подтверждение, порядок, удаление — для владельца (ListingPolicy::update).
Route::middleware('auth')->prefix('listings/{listing}/photos')->name('listings.photos.')->scopeBindings()->group(function (): void {
    Route::get('/', [ListingPhotoController::class, 'index'])->name('index');
    Route::post('uploads', [ListingPhotoController::class, 'requestUpload'])->middleware('throttle:60,1')->name('uploads');
    Route::post('/', [ListingPhotoController::class, 'store'])->middleware('throttle:60,1')->name('store');
    Route::put('order', [ListingPhotoController::class, 'reorder'])->name('order');
    Route::delete('{photo}', [ListingPhotoController::class, 'destroy'])->name('destroy');
});

// Сообщения (4.1.1): JSON для экрана сообщений (4.1.2). Отправка и новые беседы — общий лимит `messages`
// (AppServiceProvider, ARCHITECTURE §7); чужая беседа — 404.
Route::middleware('auth')->group(function (): void {
    Route::post('listings/{listing}/conversations', [ConversationController::class, 'store'])
        ->middleware('throttle:messages')
        ->name('conversations.store');
    Route::prefix('conversations/{conversation}')->name('conversations.')->group(function (): void {
        Route::get('messages', [ConversationController::class, 'messages'])->middleware('throttle:120,1')->name('messages');
        Route::post('messages', [ConversationController::class, 'send'])->middleware('throttle:messages')->name('send');
        Route::post('read', [ConversationController::class, 'read'])->middleware('throttle:120,1')->name('read');
    });

    // Экран сообщений (4.1.2): список бесед, открытая беседа и черновик «Написать продавцу» (?listing=).
    Route::get('messages', [MessagesPageController::class, 'index'])->name('messages.index');
    Route::get('messages/{conversation}', [MessagesPageController::class, 'show'])->name('messages.show');
});

// Служебная страница доставки сообщений для e2e до экрана сообщений (4.1.2): только local, testing, e2e.
Route::middleware([EnsureE2eEnvironment::class, 'auth'])->group(function (): void {
    Route::get('/_e2e/messaging', [MessagingPlaygroundController::class, 'listing'])->name('e2e.messaging');
    Route::get('/_e2e/messaging/{conversation}', [MessagingPlaygroundController::class, 'conversation'])->name('e2e.messaging.conversation');
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
Route::get('/_e2e/photo-uploader', PhotoUploaderPlaygroundController::class)->middleware([EnsureE2eEnvironment::class, 'auth'])->name('e2e.photo-uploader');
