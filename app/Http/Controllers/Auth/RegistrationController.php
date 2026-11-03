<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Domain\Accounts\Actions\CompleteLogin;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use Illuminate\Http\JsonResponse;

/**
 * Шаг первого входа: имя, город, согласие. Работает только после подтверждения почты.
 */
final class RegistrationController extends Controller
{
    public function __invoke(RegisterRequest $request, CompleteLogin $completeLogin): JsonResponse
    {
        return response()->json($completeLogin->register($request->toData())->toArray());
    }
}
