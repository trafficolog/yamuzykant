<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Listings\Actions\FindOrCreateDraft;
use App\Domain\Listings\Enums\ListingStatus;
use App\Domain\Listings\Models\Listing;
use App\Domain\Listings\StateMachines\ListingStateMachine;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;

// Ревью PR #126 (2.1.3), задача 2.1.4: один черновик на пользователя гарантирует БД — частичный уникальный
// индекс (user_id) WHERE status = 'draft'. Блокировка в FindOrCreateDraft остаётся, но не единственная защита.

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

describe('частичный уникальный индекс', function () {
    it('второй черновик того же пользователя отклоняется базой', function () {
        $user = User::factory()->create();
        Listing::factory()->for($user)->create();

        expect(fn () => Listing::factory()->for($user)->create())->toThrow(UniqueConstraintViolationException::class);
    });

    it('черновики разных пользователей не мешают друг другу', function () {
        Listing::factory()->for(User::factory()->create())->create();

        expect(Listing::factory()->for(User::factory()->create())->create()->status)->toBe(ListingStatus::Draft);
    });

    it('индекс касается только черновиков: сколько угодно объявлений в других статусах и один черновик', function () {
        $user = User::factory()->create();
        foreach ([ListingStatus::Published, ListingStatus::Published, ListingStatus::Pending, ListingStatus::Withdrawn] as $status) {
            Listing::factory()->for($user)->inStatus($status)->create();
        }

        expect(Listing::factory()->for($user)->create()->status)->toBe(ListingStatus::Draft)
            ->and(Listing::query()->where('user_id', $user->id)->count())->toBe(5);
    });

    it('после публикации черновика можно завести следующий', function () {
        $user = User::factory()->create();
        $first = Listing::factory()->for($user)->create();
        app(ListingStateMachine::class)->publish($first);

        expect(Listing::factory()->for($user)->create()->status)->toBe(ListingStatus::Draft);
    });

    it('FindOrCreateDraft находит существующий черновик, когда вставка упирается в индекс', function () {
        $user = User::factory()->create();
        $existing = Listing::factory()->for($user)->create();

        expect(app(FindOrCreateDraft::class)($user)->id)->toBe($existing->id)
            ->and(Listing::query()->where('user_id', $user->id)->count())->toBe(1);
    });

    it('на pgsql индекс частичный: в каталоге есть условие WHERE status = draft', function () {
        if (DB::getDriverName() !== 'pgsql') {
            $this->markTestSkipped('Определение индекса читается из pg_indexes.');
        }

        $definition = (string) DB::table('pg_indexes')->where('indexname', 'listings_one_draft_per_user')->value('indexdef');

        expect($definition)->toContain('UNIQUE')->and($definition)->toContain('user_id')->and($definition)->toContain("'draft'");
    });
});

/**
 * Запускает $count процессов одновременно и возвращает их разобранные ответы.
 *
 * @return list<array{ok: bool, id?: string, error?: string}>
 */
function raceDrafts(string $mode, int $userId, int $count = 2): array
{
    $startAt = microtime(true) + 2.5;
    $processes = [];
    for ($i = 0; $i < $count; $i++) {
        $process = new Process([PHP_BINARY, base_path('tests/Support/race-draft.php'), $mode, (string) $userId, (string) $startAt], base_path());
        $process->setTimeout(60);
        $process->start();
        $processes[] = $process;
    }

    $results = [];
    foreach ($processes as $process) {
        $process->wait();
        $decoded = json_decode(trim($process->getOutput()), true);
        expect($decoded)->toBeArray("процесс гонки не вернул JSON: {$process->getOutput()} {$process->getErrorOutput()}");
        $results[] = $decoded;
    }

    return $results;
}

describe('настоящая гонка двух процессов', function () {
    /** Данные должны быть зафиксированы: процессы читают БД через собственные соединения. */
    beforeEach(function () {
        if (DB::getDriverName() !== 'pgsql') {
            $this->markTestSkipped('Гонка процессов проверяется на PostgreSQL: SQLite в памяти не разделяется между процессами.');
        }

        while (DB::transactionLevel() > 0) {
            DB::rollBack();
        }
        $this->racer = User::factory()->create();
    });

    afterEach(function () {
        if (isset($this->racer)) {
            DB::table('listings')->where('user_id', $this->racer->id)->delete();
            DB::table('users')->where('id', $this->racer->id)->delete();
        }
    });

    it('два FindOrCreateDraft одновременно: один черновик, оба получают один и тот же', function () {
        $results = raceDrafts('find', $this->racer->id);

        expect(collect($results)->pluck('ok')->all())->toBe([true, true])
            ->and(collect($results)->pluck('id')->unique()->count())->toBe(1)
            ->and(Listing::query()->where('user_id', $this->racer->id)->count())->toBe(1);
    });

    it('две прямые вставки черновика одновременно (мимо блокировки): проходит одна, вторую отклоняет индекс', function () {
        $results = raceDrafts('insert', $this->racer->id);

        $ok = collect($results)->where('ok', true)->count();
        $failed = collect($results)->where('ok', false)->pluck('error')->all();

        expect($ok)->toBe(1)
            ->and($failed)->toBe([UniqueConstraintViolationException::class])
            ->and(Listing::query()->where('user_id', $this->racer->id)->where('status', 'draft')->count())->toBe(1);
    });
});
