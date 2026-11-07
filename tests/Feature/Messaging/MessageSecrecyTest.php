<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Actions\SendMessage;
use App\Domain\Messaging\Actions\StartConversation;
use App\Domain\Messaging\Events\MessageSent;
use App\Domain\Messaging\Exceptions\MessageNotSaved;
use App\Domain\Messaging\MessageBody;
use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Models\Message;
use App\Support\Observability\SentryScrubber;
use Illuminate\Broadcasting\BroadcastEvent;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Sentry\ClientBuilder;
use Sentry\Event;
use Sentry\EventHint;
use Sentry\Serializer\PayloadSerializer;
use Sentry\State\HubInterface;
use Tests\Support\MessagingFixtures;

// 4.1.4: текст сообщения не попадает ни в журнал, ни в Sentry, ни в задания очереди — в том числе при сбое БД.

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

/** Принудительная ошибка БД: таблицы сообщений нет, QueryException несёт SQL с текстом в привязках. */
function breakMessagesTable(): void
{
    DB::statement('drop table messages');
}

/**
 * Строковые значения аргументов кадров стека одной строкой (объекты не раскрываются: print_r на них зацикливается).
 *
 * @param  array<int|string, mixed>  $trace
 */
function traceDump(array $trace): string
{
    $strings = [];
    array_walk_recursive($trace, function (mixed $value) use (&$strings): void {
        if (is_string($value)) {
            $strings[] = $value;
        }
    });

    return implode("\n", $strings);
}

/** Всё, что попало в журнал, одной строкой: сырой JSON и раскодированный (без \u-экранирования). */
function logDump(string $path): string
{
    $lines = readLogLines($path);
    $decoded = array_map(
        fn (string $line): string => json_encode(json_decode($line, true), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '',
        $lines,
    );

    return implode("\n", $lines)."\n".implode("\n", $decoded);
}

it('при ошибке БД на отправке текста нет в журнале и в событии Sentry, а стек с аргументами включён', function () {
    $path = useTempJsonLog();
    $hub = app(HubInterface::class);
    $originalClient = $hub->getClient();

    /** @var list<string> $payloads */
    $payloads = [];
    $client = null;
    $client = ClientBuilder::create([
        'dsn' => null,
        'send_default_pii' => false,
        'before_send' => function (Event $event, ?EventHint $hint) use (&$payloads, &$client): ?Event {
            $scrubbed = SentryScrubber::beforeSend($event, $hint);
            $payloads[] = (new PayloadSerializer($client->getOptions()))->serialize($scrubbed);

            return null;
        },
    ])->getClient();
    $hub->bindClient($client);

    $iniBefore = (string) ini_get('zend.exception_ignore_args');
    ini_set('zend.exception_ignore_args', '0');

    try {
        $conversation = MessagingFixtures::conversation();
        $buyer = User::query()->findOrFail($conversation->buyer_id);
        breakMessagesTable();

        $this->actingAs($buyer)
            ->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Встретимся у метро Сокол zq7731'])
            ->assertStatus(500);
    } finally {
        ini_set('zend.exception_ignore_args', $iniBefore);
        if ($originalClient !== null) {
            $hub->bindClient($originalClient);
        }
    }

    $log = logDump($path);
    // Ошибка зафиксирована (иначе тест ничего не доказывает), но без текста.
    expect($log)->toContain('MessageNotSaved')
        ->and($log)->not->toContain('Сокол')
        ->and($log)->not->toContain('zq7731')
        ->and($log)->not->toContain('insert into');

    expect($payloads)->not->toBeEmpty();
    foreach ($payloads as $payload) {
        $flat = $payload."\n".json_encode(json_decode($payload, true), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        expect($flat)->not->toContain('Сокол')
            ->and($flat)->not->toContain('zq7731')
            ->and($flat)->not->toContain('insert into');
    }
});

it('исключение сохранения несёт SQLSTATE, без SQL, параметров и предыдущего исключения', function () {
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);
    breakMessagesTable();

    try {
        app(SendMessage::class)->handle($buyer, $conversation, 'Секрет zq7731');
        $this->fail('Ожидалось MessageNotSaved.');
    } catch (MessageNotSaved $e) {
        expect($e->getPrevious())->toBeNull()
            ->and($e->getMessage())->not->toContain('zq7731')
            ->and($e->getMessage())->not->toContain('insert')
            ->and($e->sqlState)->not->toBe('');
    }
});

it('в стеке исключения из SendMessage и StartConversation нет текста, даже при zend.exception_ignore_args=Off', function () {
    $iniBefore = (string) ini_get('zend.exception_ignore_args');
    ini_set('zend.exception_ignore_args', '0');

    try {
        $listing = MessagingFixtures::listing();
        $buyer = User::factory()->create();
        $conversation = MessagingFixtures::conversation($listing, $buyer);
        breakMessagesTable();

        foreach ([
            fn () => app(SendMessage::class)->handle($buyer, $conversation, 'Секрет zq7731'),
            fn () => app(StartConversation::class)->handle($buyer, $listing, 'Секрет zq7731'),
        ] as $call) {
            try {
                $call();
                $this->fail('Ожидалось исключение.');
            } catch (MessageNotSaved $e) {
                expect($e->getTraceAsString())->not->toContain('zq7731')
                    ->and(traceDump($e->getTrace()))->not->toContain('zq7731');
            }
        }
    } finally {
        ini_set('zend.exception_ignore_args', $iniBefore);
    }
});

it('в стеке исключения из MessageBody::from текста нет', function () {
    $iniBefore = (string) ini_get('zend.exception_ignore_args');
    ini_set('zend.exception_ignore_args', '0');

    try {
        MessageBody::from(str_repeat('zq7731 ', 400), 10);
        $this->fail('Ожидалось InvalidArgumentException.');
    } catch (InvalidArgumentException $e) {
        expect(traceDump($e->getTrace()))->not->toContain('zq7731');
    } finally {
        ini_set('zend.exception_ignore_args', $iniBefore);
    }
});

it('в задании очереди MessageSent нет текста: проверяется каждое такое задание', function () {
    Queue::fake();
    $conversation = MessagingFixtures::conversation();
    $buyer = User::query()->findOrFail($conversation->buyer_id);

    $this->actingAs($buyer)
        ->postJson("/conversations/{$conversation->id}/messages", ['body' => 'Встретимся у метро Сокол zq7731'])
        ->assertCreated();

    $jobs = Queue::pushed(BroadcastEvent::class, fn (BroadcastEvent $job): bool => $job->event instanceof MessageSent);
    expect($jobs)->toHaveCount(1);
    $jobs->each(fn (BroadcastEvent $job) => expect(serialize($job))->not->toContain('zq7731')->not->toContain('Сокол'));
});

it('гонка двух «Написать»: беседа уже создана параллельным запросом — сообщение уходит в неё, дубля нет', function () {
    $listing = MessagingFixtures::listing();
    $buyer = User::factory()->create();
    $winner = null;

    // Сразу после того как поиск беседы вернул «нет», «конкурент» успевает вставить такую же (и зафиксировать её).
    DB::listen(function (QueryExecuted $query) use (&$winner, $listing, $buyer): void {
        if ($winner === null && str_starts_with($query->sql, 'select') && str_contains($query->sql, 'from "conversations"')) {
            $winner = false;
            $winner = MessagingFixtures::conversation($listing, $buyer);
        }
    });

    $message = app(StartConversation::class)->handle($buyer, $listing, 'Здравствуйте');

    expect($winner)->not->toBeNull()
        ->and(Conversation::query()->count())->toBe(1)
        ->and($message->conversation_id)->toBe($winner->id)
        ->and(Message::query()->count())->toBe(1);
});
