<?php

declare(strict_types=1);

use App\Domain\Catalog\Models\InstrumentModel;

// Карточка 3.1.8: индекс моделей — с префиксом окружения, как и индекс объявлений: параллельные прогоны
// и окружения на одном Meilisearch не делят индекс.

it('индекс instrument_models называется с префиксом окружения', function () {
    expect(config('scout.prefix'))->not->toBe('')
        ->and((new InstrumentModel)->searchableAs())->toBe(config('scout.prefix').'instrument_models');
});
