<?php

declare(strict_types=1);

arch('домен не зависит от HTTP-слоя')
    ->expect('App\Domain')
    ->not->toUse('App\Http');

arch('домен не зависит от Filament-консоли')
    ->expect('App\Domain')
    ->not->toUse('App\Filament');

arch('во всём приложении включён strict_types')
    ->expect('App')
    ->toUseStrictTypes();
