<?php

declare(strict_types=1);

namespace App\Domain\Moderation\AutoChecks;

use App\Domain\Listings\Models\Listing;

/**
 * Автопроверки объявления (UC-O1, BR-04) — единая точка входа для формы, публикации и фоновой проверки.
 *
 * - validate(): только блокирующие проверки (контакты в тексте), быстрые и без обращений к другим объявлениям.
 *   Вызывается синхронно: при сохранении формы «Продать» (StoreListingRequest) и при публикации (2.1.4).
 *   Результат — ошибки по полям (`errors()`), готовые для Validator/ValidationException.
 * - assess(): все проверки как сигналы риска, включая дубль фото и цену ниже рынка; идёт в очереди
 *   (job AssessListingRisk) после публикации и существенной правки. Результат — сигналы и риск high|normal.
 *
 * Объявление для validate() может быть не сохранено — достаточно `new Listing(['title' => …, 'description' => …])`;
 * assess() работает с сохранённым объявлением.
 */
final class ListingAutoChecks
{
    /** @var list<AutoCheck> */
    private readonly array $checks;

    /** Подсказка продавцу, не признак риска: только в validate(), в assess() не участвует. */
    private readonly SerialNumberCheck $serialNumber;

    public function __construct(
        ContactsCheck $contacts,
        SerialNumberCheck $serialNumber,
        StopWordsCheck $stopWords,
        DuplicatePhotoCheck $duplicatePhoto,
        LowPriceCheck $lowPrice,
    ) {
        $this->serialNumber = $serialNumber;
        $this->checks = [$contacts, $stopWords, $duplicatePhoto, $lowPrice];
    }

    /** @return list<AutoCheck> */
    public function checks(): array
    {
        return $this->checks;
    }

    public function validate(Listing $listing): AutoCheckReport
    {
        $findings = [];
        foreach ([...$this->checks, $this->serialNumber] as $check) {
            if ($check->blocking()) {
                array_push($findings, ...$check->inspect($listing));
            }
        }

        return new AutoCheckReport(blocking: $findings);
    }

    public function assess(Listing $listing): AutoCheckReport
    {
        $findings = [];
        foreach ($this->checks as $check) {
            array_push($findings, ...$check->inspect($listing));
        }

        return new AutoCheckReport(signals: $findings);
    }
}
