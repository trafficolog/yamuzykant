<?php

declare(strict_types=1);

namespace App\Domain\Moderation\AutoChecks;

use App\Domain\Listings\Models\Listing;
use App\Domain\Moderation\AutoChecks\Contacts\TextFolding;

/**
 * Серийный номер в описании (5.1.4): продавец сам написал «серийный номер», «s/n» или «с/н» и следом номер
 * с цифрами. Подсказываем указать его в поле «Серийный номер»: поле скрыто от покупателей, а описание видно всем.
 * Только подпись и номер за ней: частоты, ёмкости, артикулы и модели («20-20000Гц», «XR18-00012», «RG7620») не трогаем.
 * Подсказка показывается как блокирующая ошибка (в форме нет другого канала), признаком риска не является:
 * ListingAutoChecks::assess() эту проверку не вызывает. Телефон ловит ContactsCheck раньше.
 */
final class SerialNumberCheck implements AutoCheck
{
    private const FIELD = 'description';

    private const LABELLED = '/(?:серийн\w*\s+номер\w*|серийник|s\/n|serial(?:\s+(?:number|no\.?))?|с\/н)[\s:#№\-]*(?=[\p{L}\p{N}\-]*\d)[\p{L}\p{N}\-]{4,}/u';

    public function code(): string
    {
        return 'serial_number';
    }

    public function blocking(): bool
    {
        return true;
    }

    public function inspect(Listing $listing): array
    {
        $text = $listing->{self::FIELD};
        if (! is_string($text) || $text === '' || preg_match(self::LABELLED, TextFolding::clean($text)) !== 1) {
            return [];
        }

        $hint = (string) __('moderation.serial.hint');

        return [new Finding(code: $this->code(), field: self::FIELD, message: $hint, hint: $hint)];
    }
}
