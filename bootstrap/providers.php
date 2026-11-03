<?php

declare(strict_types=1);

use App\Providers\AppServiceProvider;
use App\Providers\TrustedProxiesServiceProvider;

return [
    AppServiceProvider::class,
    TrustedProxiesServiceProvider::class,
];
