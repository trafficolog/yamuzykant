<?php

declare(strict_types=1);

use App\Http\Controllers\CityController;
use App\Http\Controllers\DsShowcaseController;
use App\Http\Controllers\HomeController;
use Illuminate\Support\Facades\Route;

Route::get('/', HomeController::class)->name('home');

// Город шапки (UC-S1): смена — 30 запросов в минуту с одного адреса; справочник для окна выбора.
Route::post('/city', [CityController::class, 'update'])->middleware('throttle:30,1')->name('city.update');
Route::get('/cities', [CityController::class, 'search'])->name('cities.search');

// Витрина дизайн-системы: контроллер отвечает 404 вне окружений local и stage.
Route::get('/_ds', DsShowcaseController::class)->name('ds.showcase');
