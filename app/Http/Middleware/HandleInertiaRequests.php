<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Accounts\Models\User;
use App\Domain\Accounts\Staff\StaffDirectory;
use App\Domain\Catalog\Queries\CategoryTree;
use App\Domain\Catalog\Queries\CurrentCity;
use App\Domain\Catalog\Queries\PublicCategoriesCache;
use App\Domain\Messaging\Queries\UnreadMessages;
use App\Http\Controllers\Auth\YandexLoginController;
use App\Http\Resources\Catalog\CategoryResource;
use App\Support\Flags\FeatureFlag;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Inertia\Middleware;
use Laravel\Pennant\Feature;

final class HandleInertiaRequests extends Middleware
{
    /** @var string */
    protected $rootView = 'app';

    /**
     * Общие props для всех страниц. Только явный список полей.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            // Флаги глобальные: scope null, а не текущий пользователь (for(null), а не default-scope).
            // Один запрос к таблице features на все флаги: values() загружает их пачкой.
            'flags' => fn (): array => array_map(
                fn (mixed $active): bool => (bool) $active,
                Feature::for(null)->values(array_map(
                    fn (FeatureFlag $flag): string => $flag->value,
                    FeatureFlag::cases(),
                )),
            ),
            // Справочник категорий для меню шапки: только видимые, явный список полей (CategoryResource).
            // Кэш сбрасывает наблюдатель категорий: повторный ответ не трогает таблицу, пока дерево не менялось.
            'categories' => fn (): array => PublicCategoriesCache::remember(
                fn (): array => CategoryResource::collection((new CategoryTree)->public())->resolve($request),
            ),
            // Город шапки (BR-01): только id и name; без cookie — Москва.
            'city' => fn (): ?array => $this->currentCity($request),
            // Вошедший для шапки (1.1.6, BR-04): только id, имя, город и признак сотрудника — без почты, yandex_id.
            'auth' => fn (): array => ['user' => $this->authUser($request)],
            // Итог входа через Яндекс ID для окна входа (1.1.2): status и message или name — без почты и yandex_id.
            'login' => fn (): mixed => $request->session()->get(YandexLoginController::LOGIN_WINDOW_KEY),
            // Счётчик непрочитанных сообщений вошедшего (4.1.1); у гостя — null.
            'messages' => fn (): ?array => $request->user() instanceof User
                ? ['unread' => app(UnreadMessages::class)->count($request->user())]
                : null,
            // Куда браузер подключается к Reverb: публичный ключ, хост, порт, схема — без секрета.
            // У гостя и без Reverb (вещатель null) — null: приватные каналы гостю не нужны.
            'realtime' => fn (): ?array => $this->realtime($request),
        ];
    }

    /** @return array{key: string, host: string, port: int, scheme: string}|null */
    private function realtime(Request $request): ?array
    {
        if ($request->user() === null || Config::string('broadcasting.default') !== 'reverb') {
            return null;
        }

        return [
            'key' => (string) Config::get('broadcasting.connections.reverb.key'),
            'host' => (string) Config::get('broadcasting.client.host'),
            'port' => (int) Config::get('broadcasting.client.port'),
            'scheme' => (string) Config::get('broadcasting.client.scheme'),
        ];
    }

    /** @return array{id: int, name: string, city: array{id: int, name: string}|null, is_staff: bool}|null */
    private function authUser(Request $request): ?array
    {
        $user = $request->user();
        if (! $user instanceof User) {
            return null;
        }

        $city = $user->city;

        return [
            'id' => $user->id,
            'name' => $user->name,
            'city' => $city === null ? null : ['id' => $city->id, 'name' => $city->name],
            'is_staff' => app(StaffDirectory::class)->isStaff($user),
        ];
    }

    /** @return array{id: int, name: string}|null */
    private function currentCity(Request $request): ?array
    {
        $city = (new CurrentCity)->for($request);

        return $city === null ? null : ['id' => $city->id, 'name' => $city->name];
    }
}
