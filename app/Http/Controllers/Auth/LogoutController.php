<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Domain\Accounts\Actions\Logout;
use App\Domain\Accounts\Models\User;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class LogoutController extends Controller
{
    public function logout(Logout $logout): JsonResponse
    {
        $logout->handle();

        return $this->loggedOut();
    }

    public function everywhere(Request $request, Logout $logout): JsonResponse
    {
        $user = $request->user();
        assert($user instanceof User);

        $logout->everywhere($user);

        return $this->loggedOut();
    }

    private function loggedOut(): JsonResponse
    {
        return response()->json(['status' => 'logged_out', 'redirect' => '/']);
    }
}
