<?php

declare(strict_types=1);

namespace App\Http\Controllers\Favorites;

use App\Domain\Accounts\Models\User;
use App\Domain\Favorites\Actions\AddFavorite;
use App\Domain\Favorites\Actions\RemoveFavorite;
use App\Domain\Listings\Models\Listing;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * «В избранное» (UC-S5, 4.3.1): JSON для сердца карточки и лота. PUT выставляет состояние, а не переключает его:
 * повтор (двойной клик, повтор после входа гостя) ничего не ломает. Вход — middleware `auth` (гостю 401).
 */
final class FavoriteController extends Controller
{
    public function store(Request $request, Listing $listing, AddFavorite $add): JsonResponse
    {
        Gate::authorize('favorite', $listing);
        $add->handle($this->user($request), $listing);

        return response()->json(['favorite' => true]);
    }

    /** Убрать можно и снятое с публикации: иначе оно навсегда осталось бы в списке «Избранного». */
    public function destroy(Request $request, Listing $listing, RemoveFavorite $remove): JsonResponse
    {
        $remove->handle($this->user($request), $listing->id);

        return response()->json(['favorite' => false]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
