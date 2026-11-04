<?php

declare(strict_types=1);

use App\Domain\Listings\Models\Listing;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

it('серийный номер в БД зашифрован ключом приложения', function () {
    $listing = Listing::factory()->create(['serial_enc' => 'V091234']);

    $raw = DB::table('listings')->where('id', $listing->id)->value('serial_enc');

    expect($raw)->toBeString()
        ->and(str_contains((string) $raw, 'V091234'))->toBeFalse()
        ->and(Crypt::decryptString((string) $raw))->toBe('V091234')
        ->and($listing->fresh()?->serial_enc)->toBe('V091234');
});

it('без ключа приложения серийный номер не читается', function () {
    $listing = Listing::factory()->create(['serial_enc' => 'V091234']);
    $raw = (string) DB::table('listings')->where('id', $listing->id)->value('serial_enc');

    $otherKey = new Encrypter(Encrypter::generateKey('aes-256-cbc'), 'aes-256-cbc');

    expect(fn () => $otherKey->decryptString($raw))->toThrow(DecryptException::class);
});

it('по маске нельзя восстановить номер, а маска совпадает с SPEC', function () {
    $listing = Listing::factory()->create(['serial_enc' => 'V091234']);

    expect($listing->fresh()?->serialMasked())->toBe('V09****');
});
