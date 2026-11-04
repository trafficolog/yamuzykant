<?php

declare(strict_types=1);

namespace App\Http\Controllers\Catalog;

use App\Domain\Catalog\Actions\SuggestInstrumentModel;
use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\SuggestModelRequest;
use App\Http\Resources\Catalog\InstrumentModelResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\RateLimiter;

/** POST /api/models/suggestions — модель, введённая без выбора из подсказки, уходит на модерацию. */
final class SuggestModelController extends Controller
{
    private const DAY_SECONDS = 86_400;

    public function __invoke(SuggestModelRequest $request, SuggestInstrumentModel $suggest): JsonResponse
    {
        $model = RateLimiter::attempt(
            'model-suggest:'.$request->user()?->id,
            (int) config('catalog.suggestions_per_day'),
            fn () => $suggest($request->string('text')->toString(), $request->integer('category_id')),
            self::DAY_SECONDS,
        );

        if ($model === false) {
            return response()->json(
                ['message' => __('catalog.suggestions_daily_limit')],
                Response::HTTP_TOO_MANY_REQUESTS,
            );
        }

        return InstrumentModelResource::make($model)
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }
}
