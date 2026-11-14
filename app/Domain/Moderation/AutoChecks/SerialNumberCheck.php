<?php

declare(strict_types=1);

namespace App\Domain\Moderation\AutoChecks;

use App\Domain\Listings\Models\Listing;
use App\Domain\Moderation\AutoChecks\Contacts\TextFolding;

/**
 * Номер, похожий на серийный (не телефон), в описании (5.1.4): продавцу подсказываем указать его в поле
 * «Серийный номер»: поле скрыто от покупателей, а описание видно всем. Похож на серийный:
 * слово из букв и не менее пяти цифр подряд («V091234», «AB-12345») или номер после слов «серийный номер», «s/n».
 * Модель («JCM800-2203», «SM58»), год, цена, дата и размеры не подходят: цифры в них идут короткими группами.
 * Телефон ловит ContactsCheck раньше: по одному полю показывается первая подсказка.
 */
final class SerialNumberCheck implements AutoCheck
{
    private const FIELD = 'description';

    private const LABELLED = '/(?:серийн\w*\s+номер\w*|серийник|s\/n|serial(?:\s+(?:number|no\.?))?|с\/н)[\s:#№\-]*(?=[\p{L}\p{N}\-]*\d)[\p{L}\p{N}\-]{4,}/u';

    private const WITH_LETTERS = '/(?<![\p{L}\p{N}])(?=[\p{L}\p{N}\-]*\p{L})[\p{L}\p{N}\-]*\d{5,}[\p{L}\p{N}\-]*/u';

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
        if (! is_string($text) || $text === '') {
            return [];
        }

        $folded = TextFolding::clean($text);
        if (preg_match(self::LABELLED, $folded) !== 1 && preg_match(self::WITH_LETTERS, $folded) !== 1) {
            return [];
        }

        return [new Finding(
            code: $this->code(),
            field: self::FIELD,
            message: (string) __('moderation.serial.signal', ['field' => (string) __('moderation.fields.'.self::FIELD)]),
            hint: (string) __('moderation.serial.hint'),
        )];
    }
}
