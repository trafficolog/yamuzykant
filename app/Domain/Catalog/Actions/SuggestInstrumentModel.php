<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Catalog\Enums\InstrumentModelStatus;
use App\Domain\Catalog\Models\InstrumentModel;
use InvalidArgumentException;

/**
 * Продавец ввёл бренд и модель без выбора из подсказки: текст сохраняется моделью со статусом suggested,
 * она уходит на модерацию и в подсказку не попадает. Повтор того же текста возвращает существующую запись.
 */
final class SuggestInstrumentModel
{
    public function __invoke(string $text, int $categoryId): InstrumentModel
    {
        [$brand, $name] = self::split($text);

        return InstrumentModel::query()->firstOrCreate(
            ['brand' => $brand, 'name' => $name],
            ['category_id' => $categoryId, 'status' => InstrumentModelStatus::Suggested],
        );
    }

    /**
     * Бренд — первое слово, модель — остальной текст.
     *
     * @return array{0: string, 1: string}
     */
    public static function split(string $text): array
    {
        $parts = preg_split('/\s+/u', trim($text), 2) ?: [];

        if (count($parts) !== 2 || $parts[1] === '') {
            throw new InvalidArgumentException('Нужны бренд и модель.');
        }

        return [$parts[0], $parts[1]];
    }
}
