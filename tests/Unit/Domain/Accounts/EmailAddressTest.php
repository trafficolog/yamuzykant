<?php

declare(strict_types=1);

use App\Domain\Accounts\EmailLogin\EmailAddress;

it('приводит почту к нижнему регистру и убирает пробелы по краям', function () {
    expect(EmailAddress::from('  Anna.Petrova@Example.COM ')->value)->toBe('anna.petrova@example.com');
});

it('нормализует кириллицу в нижний регистр', function () {
    expect(EmailAddress::from('Анна@Почта.РФ')->value)->toBe('анна@почта.рф');
});

it('ключ одинаков для разного регистра и не содержит саму почту', function () {
    $a = EmailAddress::from('Anna@Example.com');
    $b = EmailAddress::from('anna@example.com');

    expect($a->key())->toBe($b->key())
        ->and($a->key())->not->toContain('anna')
        ->and($a->key())->toMatch('/^[0-9a-f]{64}$/');
});

it('строковое представление — нормализованная почта', function () {
    expect((string) EmailAddress::from('A@B.RU'))->toBe('a@b.ru');
});
