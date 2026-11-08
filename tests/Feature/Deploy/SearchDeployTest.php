<?php

declare(strict_types=1);

use App\Domain\Catalog\Models\InstrumentModel;
use App\Domain\Listings\Models\Listing;
use Laravel\Scout\Searchable;
use Tests\TestCase;

uses()->group(TestCase::NO_DATABASE_GROUP);

// Карточка 3.1.8: индекс объявлений заполняется при выкатке; Meilisearch одной версии в CI, compose и stage.

/** @return list<string> */
function scoutImportModels(): array
{
    $lines = file(base_path('deploy/scout-import.txt'), FILE_IGNORE_NEW_LINES) ?: [];

    return array_values(array_filter(
        array_map('trim', $lines),
        fn (string $line): bool => $line !== '' && ! str_starts_with($line, '#'),
    ));
}

it('deploy/scout-import.txt: после первой выкатки индексируются и модели, и объявления', function () {
    $models = scoutImportModels();

    expect($models)->toContain(InstrumentModel::class)
        ->and($models)->toContain(Listing::class);
    foreach ($models as $model) {
        expect(class_exists($model))->toBeTrue("нет класса {$model}")
            ->and(class_uses_recursive($model))->toContain(Searchable::class);
    }
});

/** @return list<string> версии из образов getmeili/meilisearch в файле */
function meilisearchTags(string $path): array
{
    preg_match_all('~image:\s*getmeili/meilisearch:(\S+)~', (string) file_get_contents(base_path($path)), $matches);

    return $matches[1];
}

it('Meilisearch одной версии в CI и в compose', function () {
    $compose = meilisearchTags('compose.yaml');
    $ci = meilisearchTags('.github/workflows/ci.yml');

    expect($compose)->toHaveCount(1)
        ->and($ci)->not->toBeEmpty()
        ->and(array_unique([...$compose, ...$ci]))->toHaveCount(1);
});

it('версия Meilisearch в CI совпадает с версией, закреплённой для stage', function () {
    $stage = (string) file_get_contents(base_path('deploy/services.compose.yaml'));
    $tag = meilisearchTags('compose.yaml')[0];

    expect($stage)->toContain('# '.$tag.' ');
});
