<?php

declare(strict_types=1);

namespace App\Http\Controllers\Catalog;

use App\Domain\Catalog\Enums\InstrumentModelStatus;
use App\Domain\Catalog\Models\InstrumentModel;
use App\Domain\Catalog\Queries\CategoryTree;
use App\Http\Controllers\Controller;
use App\Http\Resources\Catalog\InstrumentModelResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** GET /api/models?q= — подсказка модели в форме «Продать» (UC-L1, п. 2). Публично, без входа. */
final class ModelSearchController extends Controller
{
    private const LIMIT = 8;

    private const MIN_QUERY_LENGTH = 2;

    public function __invoke(Request $request): AnonymousResourceCollection
    {
        $query = $request->string('q')->trim()->toString();

        if (mb_strlen($query) < self::MIN_QUERY_LENGTH) {
            return InstrumentModelResource::collection(collect());
        }

        // Индекс отдаёт порядок релевантности. Публичность проверяем ещё раз: индекс может отстать на минуту.
        $visibleCategories = array_flip((new CategoryTree)->visibleIds());
        $models = InstrumentModel::search($query)
            ->take(self::LIMIT)
            ->get()
            ->filter(fn (InstrumentModel $model): bool => $model->status === InstrumentModelStatus::Active
                && isset($visibleCategories[$model->category_id]))
            ->values();

        return InstrumentModelResource::collection($models);
    }
}
