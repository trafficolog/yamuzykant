<?php

declare(strict_types=1);

// Рабочий процесс гонки черновиков (OneDraftPerUserTest): отдельный PHP-процесс со своим соединением с БД.
// Аргументы: режим (find — FindOrCreateDraft, insert — прямая вставка в обход блокировки), id пользователя,
// момент старта (microtime): процессы стартуют одновременно. Печатает JSON {ok, id|error}.

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Actions\FindOrCreateDraft;
use App\Domain\Listings\Models\Listing;

require __DIR__.'/../../vendor/autoload.php';

$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

[, $mode, $userId, $startAt] = $argv;

while (microtime(true) < (float) $startAt) {
    usleep(100);
}

try {
    if ($mode === 'find') {
        $listing = app(FindOrCreateDraft::class)(User::query()->findOrFail((int) $userId));
    } else {
        $listing = new Listing;
        $listing->user_id = (int) $userId;
        $listing->save();
    }
    echo json_encode(['ok' => true, 'id' => $listing->id]);
} catch (Throwable $e) {
    echo json_encode(['ok' => false, 'error' => $e::class]);
}
