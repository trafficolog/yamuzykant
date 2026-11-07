<?php

declare(strict_types=1);

namespace App\Http\Controllers\Listings;

use App\Domain\Listings\Photos\PhotoStorage;
use App\Domain\Listings\Photos\PhotoUploads;
use App\Domain\Listings\Photos\SignedRouteUploads;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Config;

/**
 * Приёмник загрузки, когда хранилище не S3 (тесты, e2e без MinIO). Подпись маршрута (middleware signed)
 * закрепляет ключ, тип и размер; запрос с другим типом или размером — 403, как у S3 с подписанными заголовками.
 * При S3 маршрут отвечает 404: загрузка идёт прямо в хранилище.
 */
final class LocalPhotoUploadController extends Controller
{
    public function __invoke(Request $request, PhotoUploads $uploads): Response
    {
        // Ошибка в настройке диска не должна открыть приёмник на stage и в production.
        abort_unless(app()->environment(['local', 'testing', 'e2e']) && $uploads instanceof SignedRouteUploads, 404);

        $key = $request->string('key')->toString();
        $type = $request->string('type')->toString();
        $size = $request->integer('size');
        $body = $request->getContent();

        abort_unless(str_starts_with($key, 'uploads/') && ! str_contains($key, '..'), 403);
        abort_unless($request->header('Content-Type') === $type && strlen($body) === $size, 403);
        abort_if($size > Config::integer('photos.max_bytes'), 403);

        PhotoStorage::disk()->put($key, $body);

        return response()->noContent();
    }
}
