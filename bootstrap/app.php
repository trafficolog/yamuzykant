<?php

declare(strict_types=1);

use App\Domain\Accounts\Exceptions\ConsentRequired;
use App\Domain\Accounts\Exceptions\InvalidLoginCode;
use App\Domain\Accounts\Exceptions\RegistrationNotPending;
use App\Domain\Accounts\Exceptions\TooManyLoginAttempts;
use App\Http\Controllers\HealthController;
use App\Http\Middleware\EnsureSessionIsCurrent;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function (): void {
            // Вне группы `web`: без сессии, кук и CSRF — ответ не зависит от БД.
            Route::get('/health', HealthController::class)->name('health');
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            EnsureSessionIsCurrent::class,
            HandleInertiaRequests::class,
        ]);

        // Устаревшая сессия завершается раньше, чем `auth` решит, что пользователь вошёл.
        $middleware->prependToPriorityList(
            before: AuthenticatesRequests::class,
            prepend: EnsureSessionIsCurrent::class,
        );

        // Отдельной страницы входа нет: вход — окно в шапке (1.1.2).
        $middleware->redirectGuestsTo('/');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Код входа не попадает в old input сессии при ошибке формы.
        $exceptions->dontFlash(['code']);

        // Ожидаемые отказы входа — не ошибки: не пишутся в лог и не уходят в Sentry.
        $exceptions->dontReport([
            TooManyLoginAttempts::class,
            InvalidLoginCode::class,
            RegistrationNotPending::class,
            ConsentRequired::class,
        ]);

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
    })->create();
