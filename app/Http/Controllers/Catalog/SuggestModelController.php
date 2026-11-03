<?php

declare(strict_types=1);

namespace App\Http\Controllers\Catalog;

use App\Domain\Catalog\Actions\SuggestInstrumentModel;
use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\SuggestModelRequest;
use App\Http\Resources\Catalog\InstrumentModelResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

/** POST /api/models/suggestions — модель, введённая без выбора из подсказки, уходит на модерацию. */
final class SuggestModelController extends Controller
{
    public function __invoke(SuggestModelRequest $request, SuggestInstrumentModel $suggest): JsonResponse
    {
        $model = $suggest(
            $request->string('text')->toString(),
            $request->integer('category_id'),
        );

        return InstrumentModelResource::make($model)
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }
}
