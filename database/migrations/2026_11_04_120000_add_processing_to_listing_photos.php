<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Обработка фото (2.1.2): ключ исходника до перекодирования, pHash для будущей проверки дублей,
 * время готовности и причина ошибки. `path` — каталог отдаваемых версий фото.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('listing_photos', function (Blueprint $table) {
            $table->string('upload_key')->nullable();
            $table->char('phash', 16)->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->string('failed_reason', 32)->nullable();

            $table->index('phash');
        });
    }

    public function down(): void
    {
        Schema::table('listing_photos', function (Blueprint $table) {
            $table->dropIndex(['phash']);
        });
        Schema::table('listing_photos', function (Blueprint $table) {
            $table->dropColumn(['upload_key', 'phash', 'processed_at', 'failed_reason']);
        });
    }
};
