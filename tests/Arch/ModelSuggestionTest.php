<?php

declare(strict_types=1);

// 1.2.2: суточный лимит предложений моделей нельзя обойти. Весь код приложения предлагает модель только
// через SuggestInstrumentModel::forUser() — она сама считает общий лимит `model-suggest:{user}`.

it('SuggestInstrumentModel вызывается в app/ только через forUser()', function () {
    $root = dirname(__DIR__, 2).'/app';
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
    $offenders = [];

    foreach ($iterator as $file) {
        if (! $file instanceof SplFileInfo || $file->getExtension() !== 'php' || $file->getFilename() === 'SuggestInstrumentModel.php') {
            continue;
        }
        $code = (string) file_get_contents($file->getPathname());
        if (! str_contains($code, 'SuggestInstrumentModel')) {
            continue;
        }
        // Прямой вызов экземпляра как функции: `($this->suggest)(`, `$suggest(`, `app(SuggestInstrumentModel::class)(`.
        // `($this->suggest)(…)`, `$suggest(…)`, `app(SuggestInstrumentModel::class)(…)`.
        if (preg_match('/\(\$this->\w+\)\s*\(|\$suggest\s*\(|SuggestInstrumentModel::class\)\s*\(/', $code) === 1) {
            $offenders[] = $file->getPathname();
        }
    }

    expect($offenders)->toBe([]);
});
