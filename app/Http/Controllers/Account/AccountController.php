<?php

declare(strict_types=1);

namespace App\Http\Controllers\Account;

use App\Domain\Accounts\Actions\UpdateProfile;
use App\Domain\Accounts\Models\User;
use App\Domain\Accounts\Queries\CabinetOverview;
use App\Domain\Listings\Queries\MyListings;
use App\Domain\Notifications\NotificationPreferences;
use App\Http\Controllers\Controller;
use App\Http\Requests\Account\UpdateNotificationsRequest;
use App\Http\Requests\Account\UpdateProfileRequest;
use App\Http\Resources\Listings\MyListingResource;
use App\Support\MemberSince;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Кабинет (UC-A2, 1.1.3): «Обзор» и «Профиль». Вход — middleware `auth` на маршрутах.
 * Почта уходит на фронт только здесь и только её владельцу (BR-04): в общих props её нет.
 */
final class AccountController extends Controller
{
    public function overview(Request $request, CabinetOverview $overview): Response
    {
        $user = $this->user($request);

        return Inertia::render('Account/Overview', [
            'buying' => $overview->buying($user),
            'selling' => $overview->selling($user),
        ]);
    }

    /** «Объявления» (UC-L3, UC-L4, 2.1.5): свои объявления с фильтром по статусам; действия — ManageListingController. */
    public function listings(Request $request, MyListings $listings): Response
    {
        $user = $this->user($request);
        $status = $request->query('status');
        $filter = MyListings::filter(is_string($status) ? $status : null);

        return Inertia::render('Account/Listings', [
            'listings' => MyListingResource::collection($listings->for($user, $filter))->resolve($request),
            'filter' => $filter,
            'counts' => $listings->counts($user),
        ]);
    }

    public function profile(Request $request): Response
    {
        $user = $this->user($request);
        $city = $user->city;
        $notifications = [];
        foreach (NotificationPreferences::for($user) as $key => $enabled) {
            $notifications[] = ['key' => $key, 'enabled' => $enabled];
        }

        return Inertia::render('Account/Profile', [
            'profile' => [
                'name' => $user->name,
                'email' => $user->email,
                'city' => $city === null ? null : ['id' => $city->id, 'name' => $city->name, 'type' => $city->settlement_type],
                'yandex_connected' => $user->yandex_id !== null,
                'since' => MemberSince::month($user->created_at),
            ],
            'notifications' => $notifications,
        ]);
    }

    public function updateProfile(UpdateProfileRequest $request, UpdateProfile $update): RedirectResponse
    {
        $update->handle($this->user($request), $request->name(), $request->cityId());

        return back();
    }

    public function updateNotifications(UpdateNotificationsRequest $request): RedirectResponse
    {
        NotificationPreferences::update($this->user($request), $request->changes());

        return back();
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
