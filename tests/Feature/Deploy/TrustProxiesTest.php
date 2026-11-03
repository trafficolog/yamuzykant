<?php

declare(strict_types=1);

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Перед stage нет прокси и CDN (решение OWNER 03.11.2026): Nginx передаёт PHP-FPM адрес клиента
// в REMOTE_ADDR. Доверенный прокси — только 127.0.0.1, поэтому поддельный X-Forwarded-For от клиента
// не меняет IP, по которому считаются лимиты (задача 0.1.4).

beforeEach(function () {
    Route::get('/_test/ip', fn (Request $request) => response()->json(['ip' => $request->ip()]));
    Route::middleware('throttle:2,1')
        ->get('/_test/limited', fn (Request $request) => response()->json(['ip' => $request->ip()]));
});

it('поддельный X-Forwarded-For от клиента не меняет IP', function () {
    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.7'])
        ->withHeader('X-Forwarded-For', '198.51.100.1')
        ->getJson('/_test/ip')
        ->assertExactJson(['ip' => '203.0.113.7']);
});

it('адреса частных сетей не считаются доверенными прокси', function (string $remote) {
    $this->withServerVariables(['REMOTE_ADDR' => $remote])
        ->withHeader('X-Forwarded-For', '198.51.100.1')
        ->getJson('/_test/ip')
        ->assertExactJson(['ip' => $remote]);
})->with(['10.0.0.5', '192.168.1.10', '172.16.0.2', '127.0.0.2']);

it('X-Forwarded-For принимается только от 127.0.0.1', function () {
    $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1'])
        ->withHeader('X-Forwarded-For', '198.51.100.1')
        ->getJson('/_test/ip')
        ->assertExactJson(['ip' => '198.51.100.1']);
});

it('смена X-Forwarded-For не обходит лимит запросов с одного IP', function () {
    foreach (['198.51.100.1', '198.51.100.2'] as $forged) {
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9'])
            ->withHeader('X-Forwarded-For', $forged)
            ->getJson('/_test/limited')
            ->assertOk();
    }

    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9'])
        ->withHeader('X-Forwarded-For', '198.51.100.3')
        ->getJson('/_test/limited')
        ->assertStatus(429);
});
