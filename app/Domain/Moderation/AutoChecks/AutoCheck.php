<?php

declare(strict_types=1);

namespace App\Domain\Moderation\AutoChecks;

use App\Domain\Listings\Models\Listing;

/**
 * Автопроверка объявления (UC-O1). Блокирующая проверка не пускает отправку формы и публикацию
 * (подсказка продавцу — Finding::$hint), остальные только оставляют сигналы риска для модератора.
 * Проверка читает объявление, но ничего не меняет; объявление может быть не сохранено (содержимое формы).
 */
interface AutoCheck
{
    /** Стабильный код признака: ключ в moderation_flags.signals и в тестах. */
    public function code(): string;

    public function blocking(): bool;

    /** @return list<Finding> */
    public function inspect(Listing $listing): array;
}
