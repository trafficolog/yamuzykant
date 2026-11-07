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
 * (например expired → withdrawn) момент не сдвигает. Существующим строкам — updated_at как лучшее приближение.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('listings', function (Blueprint $table): void {
            $table->timestamp('unpublished_at')->nullable()->after('published_at');
        });

        DB::table('listings')
            ->whereIn('status', ['pending', 'needs_changes', 'rejected', 'withdrawn', 'expired'])
            ->update(['unpublished_at' => DB::raw('updated_at')]);
    }

    public function down(): void
    {
        Schema::table('listings', function (Blueprint $table): void {
            $table->dropColumn('unpublished_at');
        });
    }
};
