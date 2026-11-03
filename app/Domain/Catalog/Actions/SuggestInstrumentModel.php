<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Catalog\Enums\InstrumentModelStatus;
use App\Domain\Catalog\Models\InstrumentModel;
use InvalidArgumentException;
use LogicException;

/**
 * Продавец ввёл бренд и модель без выбора из подсказки: текст сохраняется моделью со статусом suggested,
 * она уходит на модерацию и в подсказку не попадает. Существующая модель (без учёта регистра) не меняется
 * и возвращается как есть; при гонке параллельных отправок возвращается та запись, что успела вставиться.
 */
final class SuggestInstrumentModel
{
    public function __invoke(string $text, int $categoryId): InstrumentModel
    {
        [$brand, $name] = self::split($text);

        $existing = self::find($brand, $name);
        if ($existing !== null) {
            return $existing;
        }

        // INSERT ... ON CONFLICT DO NOTHING: если между проверкой и вставкой другой запрос создал ту же модель,
        // ошибка уникальности не возникает и транзакция не прерывается (в PostgreSQL прерванная транзакция
        // ломает последующие запросы). Предложенная модель не индексируется, поэтому событий Eloquent не нужно.
        $now = now();
        InstrumentModel::query()->insertOrIgnore([
            'brand' => $brand,
            'name' => $name,
            'category_id' => $categoryId,
            'status' => InstrumentModelStatus::Suggested->value,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return self::find($brand, $name) ?? throw new LogicException('Предложенная модель не найдена после вставки.');
    }

    /**
     * Пробелы по краям и внутри схлопываются. Бренд — первое слово, модель — остальной текст.
     *
     * @return array{0: string, 1: string}
     */
    public static function split(string $text): array
    {
        $normalized = (string) preg_replace('/\s+/u', ' ', trim($text));
        $parts = explode(' ', $normalized, 2);

        if (count($parts) !== 2 || $parts[1] === '') {
            throw new InvalidArgumentException('Нужны бренд и модель.');
        }

        return [$parts[0], $parts[1]];
    }

    private static function find(string $brand, string $name): ?InstrumentModel
    {
        return InstrumentModel::query()
            ->whereRaw('lower(brand) = ?', [mb_strtolower($brand)])
            ->whereRaw('lower(name) = ?', [mb_strtolower($name)])
            ->first();
    }
}
