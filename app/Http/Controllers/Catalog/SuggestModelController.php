<?php

declare(strict_types=1);

namespace App\Http\Controllers\Catalog;

use App\Domain\Catalog\Actions\SuggestInstrumentModel;
use App\Domain\Catalog\Exceptions\SuggestionLimitReached;
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
        try {
            $model = $suggest->forUser(
                (int) $request->user()?->id,
                $request->string('text')->toString(),
                $request->integer('category_id'),
            );
        } catch (SuggestionLimitReached $e) {
            return response()->json(['message' => $e->getMessage()], Response::HTTP_TOO_MANY_REQUESTS);
        }

        return InstrumentModelResource::make($model)
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }
}
