<?php

declare(strict_types=1);

use Tests\Support\StatusWriteScanner;

// AGENTS.md §4: статусы — PHP enum, переходы — только через *StateMachine.

it('сканер ловит прямую запись статуса', function (string $code) {
    expect(StatusWriteScanner::scan("<?php\n".$code))->not->toBeEmpty();
})->with([
    'присваивание' => ['$listing->status = ListingStatus::Published;'],
    'присваивание без пробелов' => ['$listing->status=ListingStatus::Published;'],
    '??=' => ['$listing->status ??= ListingStatus::Draft;'],
    'ArrayAccess' => ['$listing[\'status\'] = "published";'],
    'setAttribute' => ['$listing->setAttribute(\'status\', "published");'],
    'update' => ['$listing->update([\'status\' => ListingStatus::Published]);'],
    'update в несколько строк' => ["\$listing->update([\n    'price' => 1,\n    \"status\" => 'published',\n]);"],
    'массовый update запросом' => ['Listing::query()->where(\'id\', $id)->update([\'status\' => \'expired\']);'],
    'updateQuietly' => ['$listing->updateQuietly([\'status\' => \'expired\']);'],
    'fill' => ['$listing->fill([\'status\' => \'expired\'])->save();'],
    'forceFill' => ['$listing->forceFill([\'status\' => \'expired\'])->save();'],
    'updateOrCreate' => ['Listing::updateOrCreate([\'id\' => $id], [\'status\' => \'expired\']);'],
    'DB::table()->update' => ['DB::table(\'listings\')->update([\'status\' => \'expired\']);'],
    'сырой SQL' => ['DB::statement("UPDATE listings SET status = \'expired\'");'],
]);

it('сканер не трогает чтение статуса и ответы со словом status', function (string $code) {
    expect(StatusWriteScanner::scan("<?php\n".$code))->toBe([]);
})->with([
    'сравнение' => ['if ($listing->status === ListingStatus::Draft) {}'],
    'нестрогое сравнение' => ['if ($listing->status == $other) {}'],
    'фильтр запроса' => ['Listing::query()->where(\'status\', ListingStatus::Published)->get();'],
    'JSON-ответ' => ['return response()->json([\'status\' => \'ok\']);'],
    'match' => ['return match ($this->status) { default => 1 };'],
    'комментарий' => ['// $listing->update([\'status\' => \'x\']);'],
    'док-блок' => ["/**\n * \$listing->status = 'x';\n */"],
]);

it('вне StateMachines статус напрямую не меняется нигде в app/', function () {
    expect(StatusWriteScanner::scanDirectory(dirname(__DIR__, 2).'/app'))->toBe([]);
});

it('машина статусов объявления лежит в StateMachines и сама пишет статус', function () {
    $path = dirname(__DIR__, 2).'/app/Domain/Listings/StateMachines/ListingStateMachine.php';

    expect(is_file($path))->toBeTrue()
        ->and(StatusWriteScanner::scan((string) file_get_contents($path)))->not->toBeEmpty();
});

it('статусы и состояние объявления — PHP enum', function () {
    expect('App\Domain\Listings\Enums')->toBeEnums();
});

it('status не входит в массовое заполнение модели объявления', function () {
    $fillable = (new ReflectionClass('App\Domain\Listings\Models\Listing'))->getDefaultProperties()['fillable'] ?? [];

    expect($fillable)->toBeArray()->toContain('price')
        ->and(in_array('status', (array) $fillable, true))->toBeFalse();
});
