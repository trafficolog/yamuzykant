<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Domain\Accounts\Actions\CompleteLogin;
use App\Domain\Accounts\Actions\SendLoginCode;
use App\Domain\Accounts\Actions\VerifyLoginCode;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\SendLoginCodeRequest;
use App\Http\Requests\Auth\VerifyLoginCodeRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Config;

/**
 * JSON-эндпоинты окна входа (1.1.2). Ошибки лимитов и кода — bootstrap/app.php.
 */
final class EmailLoginController extends Controller
{
    public function sendCode(
        SendLoginCodeRequest $request,
        SendLoginCode $sendLoginCode,
        CompleteLogin $completeLogin,
    ): JsonResponse {
        $completeLogin->startAttempt($request->emailAddress());
        $sendLoginCode->handle($request->emailAddress(), (string) $request->ip());

        // Ответ не зависит от того, есть ли аккаунт с этой почтой.
        return response()->json([
            'status' => 'code_sent',
            'expires_in' => Config::integer('login.code_ttl'),
        ], 202);
    }

    public function verify(
        VerifyLoginCodeRequest $request,
        VerifyLoginCode $verifyLoginCode,
        CompleteLogin $completeLogin,
    ): JsonResponse {
        $completeLogin->startAttempt($request->emailAddress());
        $identity = $verifyLoginCode->handle($request->emailAddress(), $request->code(), (string) $request->ip());

        return response()->json($completeLogin->handle($identity)->toArray());
    }
}
