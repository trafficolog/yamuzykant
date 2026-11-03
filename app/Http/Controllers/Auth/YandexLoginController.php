<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Domain\Accounts\Actions\LoginWithYandex;
use App\Domain\Accounts\Data\LoginStatus;
use App\Domain\Accounts\Data\ReturnPath;
use App\Domain\Accounts\Exceptions\InvalidYandexState;
use App\Domain\Accounts\Exceptions\YandexLoginFailed;
use App\Domain\Accounts\YandexLogin\YandexOAuth;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\RedirectResponse as SymfonyRedirectResponse;

/**
 * Вход через Яндекс ID (1.1.5). Итог для окна входа (1.1.2) — flash `login_window`
 * (Inertia prop `login`): явный список полей, без почты и yandex_id.
 */
final class YandexLoginController extends Controller
{
    public const string LOGIN_WINDOW_KEY = 'login_window';

    public function redirect(Request $request, YandexOAuth $oauth): SymfonyRedirectResponse
    {
        // Адрес возврата к действию — в сессии и только относительный путь.
        if ($request->query->has('return')) {
            $request->session()->put('url.intended', ReturnPath::sanitize($request->query('return')));
        }

        return $oauth->redirect();
    }

    public function callback(Request $request, YandexOAuth $oauth, LoginWithYandex $loginWithYandex): RedirectResponse
    {
        try {
            $result = $loginWithYandex->handle($oauth->account());
        } catch (InvalidYandexState) {
            abort(403);
        } catch (YandexLoginFailed) {
            return $this->backToLoginWindow($request, [
                'status' => 'yandex_cancelled',
                'message' => __('login.yandex_cancelled'),
            ]);
        }

        if ($result->status === LoginStatus::Authenticated) {
            return redirect()->to($result->redirect ?? '/');
        }

        return $this->backToLoginWindow($request, $result->toArray());
    }

    /**
     * Возврат на страницу, где начат вход; адрес возврата остаётся в сессии до входа.
     *
     * @param  array<string, mixed>  $loginWindow
     */
    private function backToLoginWindow(Request $request, array $loginWindow): RedirectResponse
    {
        return redirect()->to(ReturnPath::sanitize($request->session()->get('url.intended')))
            ->with(self::LOGIN_WINDOW_KEY, $loginWindow);
    }
}
