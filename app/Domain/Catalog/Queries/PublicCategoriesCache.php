<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Queries;

use Closure;
use Illuminate\Support\Facades\Cache;

/**
 * Кэш публичного дерева категорий для shared prop `categories`. Ключ один, сбрасывается наблюдателем
 * CategoryObserver при любом сохранении или удалении категории. Запись вне Eloquent (голый SQL) кэш не сбрасывает.
 */
final class PublicCategoriesCache
{
    public const KEY = 'catalog.categories.public';

    /**
     * @param  Closure(): array<int, array<string, mixed>>  $build
     * @return array<int, array<string, mixed>>
     */
    public static function remember(Closure $build): array
    {
        return Cache::rememberForever(self::KEY, $build);
    }

    public static function forget(): void
    {
        Cache::forget(self::KEY);
    }
}
