<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Support\Flags\FeatureFlag;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Laravel\Pennant\Feature;

final class HandleInertiaRequests extends Middleware
{
    /** @var string */
    protected $rootView = 'app';

    /**
     * Общие props для всех страниц. Только явный список полей.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            // Флаги глобальные: scope null, а не текущий пользователь (for(null), а не default-scope).
            'flags' => fn (): array => collect(FeatureFlag::cases())
                ->mapWithKeys(fn (FeatureFlag $flag): array => [
                    $flag->value => Feature::for(null)->active($flag->value),
                ])
                ->all(),
        ];
    }
}
