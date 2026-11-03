<?php

declare(strict_types=1);

use App\Support\Flags\FeatureFlag;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Pennant\Feature;

// Файл не перечислен в tests/Pest.php: БД с нуля (RefreshDatabase) задаёт TestCase для всех Feature-тестов.

it('Inertia-страница с флагами работает в пустой БД без регистрации файла', function () {
    expect(DB::table('features')->count())->toBe(0);

    Feature::for(null)->activate(FeatureFlag::Masters->value);

    $this->get('/')->assertInertia(fn (Assert $page) => $page->where('flags.masters', true));
});
