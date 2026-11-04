<?php

declare(strict_types=1);

namespace App\Domain\Search\Console;

use App\Domain\Search\Actions\ReconcileListingIndex;
use Illuminate\Console\Command;

final class ReconcileListingIndexCommand extends Command
{
    protected $signature = 'listings:reconcile-index';

    protected $description = 'Сверить индекс объявлений с БД: добавить недостающее опубликованное, убрать лишнее';

    public function handle(ReconcileListingIndex $reconcile): int
    {
        $result = $reconcile();

        $this->info("Сверка индекса: добавлено {$result['added']}, убрано {$result['removed']}.");

        return self::SUCCESS;
    }
}
