<?php

declare(strict_types=1);

use App\Domain\Accounts\Exceptions\ConsentRequired;
use App\Domain\Accounts\Exceptions\InvalidLoginCode;
use App\Domain\Accounts\Exceptions\InvalidYandexState;
use App\Domain\Accounts\Exceptions\RegistrationNotPending;
use App\Domain\Accounts\Exceptions\TooManyLoginAttempts;
use App\Domain\Accounts\Exceptions\YandexLoginFailed;
use App\Domain\Accounts\Exceptions\YandexLoginNotPending;
use App\Domain\Listings\Exceptions\PhotoRejected;
use App\Domain\Listings\Exceptions\PhotoRequirementsNotMet;
use App\Domain\Messaging\Exceptions\CannotMessageYourself;
use App\Domain\Messaging\Exceptions\ConversationClosed;
use App\Domain\Messaging\Exceptions\ListingNotAvailable;
use App\Domain\Messaging\Exceptions\NewChatLimitReached;
use App\Http\Controllers\HealthController;
use App\Http\Middleware\AssignRequestId;
use App\Http\Middleware\EnsureE2eEnvironment;
use App\Http\Middleware\EnsureSessionIsCurrent;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\ThrottleHealth;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Route;
use Sentry\Laravel\Integration;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function (): void {
            // Вне группы `web`: без сессии, кук и CSRF — ответ не зависит от БД.
            Route::get('/health', HealthController::class)->middleware(ThrottleHealth::class)->name('health');
        },
    )
    // Авторизация приватных каналов Reverb (4.1.1): сессия web, лимит частоты; гость и чужой — 403.
    ->withBroadcasting(__DIR__.'/../routes/channels.php', ['middleware' => ['web', 'throttle:120,1']])
    ->withMiddleware(function (Middleware $middleware): void {
        // request_id для всех запросов, включая /health и /up: в журнале, Sentry, заданиях очереди и ответе.
        $middleware->prepend(AssignRequestId::class);

        $middleware->web(append: [
            EnsureSessionIsCurrent::class,
            HandleInertiaRequests::class,
        ]);

        // Устаревшая сессия завершается раньше, чем `auth` решит, что пользователь вошёл.
        $middleware->prependToPriorityList(
            before: AuthenticatesRequests::class,
            prepend: EnsureSessionIsCurrent::class,
        );

        // Служебные страницы /_e2e/*: окружение проверяется раньше входа, чтобы гость на stage и production видел 404.
        $middleware->prependToPriorityList(
            before: AuthenticatesRequests::class,
            prepend: EnsureE2eEnvironment::class,
        );

        // Отдельной страницы входа нет: вход — окно в шапке (1.1.2).
        $middleware->redirectGuestsTo('/');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Исключения уходят в Sentry (если задан DSN); ПДн чистит SentryScrubber.
        Integration::handles($exceptions);

        // Код входа не попадает в old input сессии при ошибке формы.
        // Текст сообщения (4.1.1) и серийный номер из формы «Продать» (2.1.3) тоже не сохраняются в сессии.
        $exceptions->dontFlash(['code', 'body', 'serial']);

        // Ожидаемые отказы входа — не ошибки: не пишутся в лог и не уходят в Sentry.
        $exceptions->dontReport([
            TooManyLoginAttempts::class,
            InvalidLoginCode::class,
            RegistrationNotPending::class,
            ConsentRequired::class,
            PhotoRejected::class,
            PhotoRequirementsNotMet::class,
            InvalidYandexState::class,
            YandexLoginFailed::class,
            YandexLoginNotPending::class,
            CannotMessageYourself::class,
            ListingNotAvailable::class,
            ConversationClosed::class,
            NewChatLimitReached::class,
        ]);

        // Сообщения (4.1.1): объявление не в published — 404, как у отсутствующего (SPEC §6.1).
        $exceptions->render(fn (ListingNotAvailable $e): JsonResponse => response()->json(['message' => __('Not Found')], 404));

        $exceptions->render(fn (CannotMessageYourself $e): JsonResponse => response()->json(['message' => $e->getMessage()], 403));

        $exceptions->render(fn (ConversationClosed $e): JsonResponse => response()->json(['message' => $e->getMessage()], 409));

        // Антиспам (4.1.3): суточный лимит новых бесед. Retry-After — до конца окна неизвестен точно (ключ по пользователю),
        // клиенту достаточно текста.
        $exceptions->render(fn (NewChatLimitReached $e): JsonResponse => response()->json(['message' => $e->getMessage()], 429));

        // Отказы по фото (BR-03) — как ошибка валидации поля формы.
        $exceptions->render(fn (PhotoRejected $e): JsonResponse => response()->json([
            'message' => $e->getMessage(),
            'errors' => [$e->field => [$e->getMessage()]],
        ], 422));

        $exceptions->render(fn (PhotoRequirementsNotMet $e): JsonResponse => response()->json([
            'message' => $e->getMessage(),
            'errors' => ['photos' => $e->shortfall->messages()],
        ], 422));

        $exceptions->render(fn (TooManyLoginAttempts $e): JsonResponse => response()->json([
            'message' => __('login.throttled', ['minutes' => $e->minutes()]),
            'retry_after' => $e->retryAfter,
        ], 429, ['Retry-After' => (string) $e->retryAfter]));

        $exceptions->render(fn (InvalidLoginCode $e): JsonResponse => response()->json([
            'message' => __('login.invalid_code'),
            'errors' => ['code' => [__('login.invalid_code')]],
        ], 422));

        $exceptions->render(fn (ConsentRequired $e): JsonResponse => response()->json([
            'message' => __('login.validation.consent_required'),
            'errors' => ['consent' => [__('login.validation.consent_required')]],
        ], 422));

        $exceptions->render(fn (RegistrationNotPending $e): JsonResponse => response()->json([
            'message' => __('login.registration_not_pending'),
        ], 409));

        $exceptions->render(fn (YandexLoginNotPending $e): JsonResponse => response()->json([
            'message' => __('login.yandex_cancelled'),
        ], 409));
    })->create();
