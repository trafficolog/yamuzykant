<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/** Справочники: категории, модели, города. Идемпотентен. */
class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            CategorySeeder::class,
            InstrumentModelSeeder::class,
            CitySeeder::class,
        ]);
    }
}
