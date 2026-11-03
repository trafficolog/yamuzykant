<?php

declare(strict_types=1);

use App\Domain\Catalog\Search\ModelAliases;

// Ревью 1.2.2: синоним совпадает по целым словам, а не по подстроке.

it('синоним находит модель по целому слову', function () {
    expect(ModelAliases::for('Fender', 'American Vintage ’57 Stratocaster'))->toContain('стратокастер');
});

it('подстрока внутри другого слова не даёт синоним', function () {
    expect(ModelAliases::for('Bossanova', 'Pro'))->toBe([]);
});

it('многословный термин совпадает целиком и без учёта регистра', function () {
    expect(ModelAliases::for('Electro-Harmonix', 'BIG MUFF Pi'))->toContain('биг маф');
});
