<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Domain\Accounts\Actions\LoginWithYandex;
use App\Domain\Accounts\Actions\SendLoginCode;
use App\Domain\Accounts\Actions\VerifyLoginCode;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\SendLoginCodeRequest;
use App\Http\Requests\Auth\VerifyLoginCodeRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Config;

/**
 * Шаг «Введите почту», когда Яндекс ID не отдал почту (UC-A1, 1a): подтверждение кодом 1.1.1
 * с теми же лимитами; после проверки кода Яндекс ID привязывается к аккаунту с этой почтой.
 */
final class YandexEmailController extends Controller
{
    public function sendCode(
        SendLoginCodeRequest $request,
        LoginWithYandex $loginWithYandex,
        SendLoginCode $sendLoginCode,
    ): JsonResponse {
        $loginWithYandex->ensurePending($request->emailAddress());
        $sendLoginCode->handle($request->emailAddress(), (string) $request->ip());

        return response()->json([
            'status' => 'code_sent',
            'expires_in' => Config::integer('login.code_ttl'),
        ], 202);
    }

    public function verify(
        VerifyLoginCodeRequest $request,
        LoginWithYandex $loginWithYandex,
        VerifyLoginCode $verifyLoginCode,
    ): JsonResponse {
        $loginWithYandex->ensurePending($request->emailAddress());
        $identity = $verifyLoginCode->handle($request->emailAddress(), $request->code(), (string) $request->ip());

        return response()->json($loginWithYandex->completeWithEmail($identity)->toArray());
    }
}
