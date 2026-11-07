<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Момент, когда объявление перестало быть published (снято, истекло, ушло на проверку после правки).
 * От него считается срок ответов в беседах (SPEC BR-10, messaging.reply_window_days). Ведёт ListingStateMachine:
 * ставит при уходе из published, сбрасывает при возврате в published; переход между не-published статусами
 * (например expired → withdrawn) момент не сдвигает. Существующим не-published строкам, которые реально были
 * опубликованы (published_at не пуст), — updated_at как лучшее приближение; остальным null.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('listings', function (Blueprint $table): void {
            $table->timestamp('unpublished_at')->nullable()->after('published_at');
        });

        // Только то, что реально было опубликовано (published_at не пуст); остальным null — окно закрыто.
        DB::table('listings')
            ->whereIn('status', ['withdrawn', 'expired', 'needs_changes', 'rejected'])
            ->whereNotNull('published_at')
            ->update(['unpublished_at' => DB::raw('updated_at')]);
    }

    public function down(): void
    {
        Schema::table('listings', function (Blueprint $table): void {
            $table->dropColumn('unpublished_at');
        });
    }
};
