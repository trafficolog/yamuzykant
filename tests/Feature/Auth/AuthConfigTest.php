<?php

declare(strict_types=1);

it('брокера паролей пользователей нет: паролей у пользователей нет', function () {
    expect(config('auth.passwords'))->toBeNull()
        ->and(config('auth.defaults.passwords'))->toBeNull();
});
