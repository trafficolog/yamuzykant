<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Actions\SendMessage;
use App\Domain\Messaging\Models\Conversation;
use App\Domain\Messaging\Models\Message;
use App\Domain\Messaging\Spam\SpamDetector;
use App\Domain\Messaging\Spam\SpamSignal;
use Tests\Support\MessagingFixtures;

// 4.1.3: признаки подозрительного сообщения — по одному тесту на каждый.

beforeEach(function () {
    config(['scout.driver' => 'null']);
});

function accountAged(int $hours): User
{
    $user = User::factory()->create();
    $user->forceFill(['created_at' => now()->subHours($hours)])->save();

    return $user;
}

function detect(User $sender, string $body, ?Conversation $conversation = null): array
{
    return app(SpamDetector::class)->detect($sender, $conversation ?? MessagingFixtures::conversation(buyer: $sender), $body);
}

describe('внешняя ссылка от нового аккаунта', function () {
    it('аккаунт младше 24 ч со ссылкой — признак', function () {
        expect(detect(accountAged(2), 'Посмотрите тут https://example.com/pay'))->toBe([SpamSignal::NewAccountLink]);
    });

    it('ссылка без схемы, «слово.зона», тоже считается', function () {
        expect(detect(accountAged(2), 'Фото на disk-share.ru'))->toBe([SpamSignal::NewAccountLink]);
    });

    it('аккаунт старше 24 ч со ссылкой — без признака', function () {
        expect(detect(accountAged(25), 'Посмотрите тут https://example.com/pay'))->toBe([]);
    });

    it('порог возраста — в конфиге', function () {
        config(['messaging.spam.new_account_hours' => 72]);

        expect(detect(accountAged(48), 'https://example.com'))->toBe([SpamSignal::NewAccountLink]);
    });

    it('ссылка на сам ЯМузыкант не внешняя', function () {
        $host = parse_url((string) config('app.url'), PHP_URL_HOST);

        expect(detect(accountAged(1), "Вот объявление: https://{$host}/listings/abc"))->toBe([]);
    });

    it('текст без ссылки от нового аккаунта — без признака', function () {
        expect(detect(accountAged(1), 'Здравствуйте, гитара ещё продаётся?'))->toBe([]);
    });
});

describe('просьба перейти в мессенджер', function () {
    it('упоминание мессенджера с призывом — признак у любого аккаунта', function () {
        expect(detect(accountAged(500), 'Давайте общаться в телеграм, так быстрее'))->toBe([SpamSignal::MessengerRequest]);
    });

    it('ник в телеграме — признак', function () {
        expect(detect(accountAged(500), 'Напишите мне @fast_deal_77'))->toBe([SpamSignal::MessengerRequest]);
    });

    it('обычный текст — без признака', function () {
        expect(detect(accountAged(500), 'Могу приехать в субботу после обеда'))->toBe([]);
    });
});

describe('одинаковый текст в ≥ 5 чатах', function () {
    function sendSame(User $sender, string $text, int $chats): void
    {
        foreach (range(1, $chats) as $ignored) {
            app(SendMessage::class)->handle($sender, MessagingFixtures::conversation(buyer: $sender), $text);
        }
    }

    it('в пятом чате — признак, в четвёртом ещё нет', function () {
        $sender = accountAged(500);
        sendSame($sender, 'Продаю дёшево, пишите', 4);

        $fifth = MessagingFixtures::conversation(buyer: $sender);
        expect(app(SpamDetector::class)->detect($sender, $fifth, 'Продаю дёшево, пишите'))->toBe([SpamSignal::SameTextManyChats]);
    });

    it('регистр, пробелы и переводы строк не спасают от признака', function () {
        $sender = accountAged(500);
        sendSame($sender, 'Продаю дёшево, пишите', 4);

        $fifth = MessagingFixtures::conversation(buyer: $sender);
        expect(app(SpamDetector::class)->detect($sender, $fifth, "  ПРОДАЮ  дёшево,\nпишите "))->toBe([SpamSignal::SameTextManyChats]);
    });

    it('много одинаковых сообщений в одном чате — не рассылка', function () {
        $sender = accountAged(500);
        $conversation = MessagingFixtures::conversation(buyer: $sender);
        foreach (range(1, 6) as $ignored) {
            app(SendMessage::class)->handle($sender, $conversation, 'ок');
        }

        expect(app(SpamDetector::class)->detect($sender, $conversation, 'ок'))->toBe([]);
    });

    it('сообщения старше окна не считаются, окно — в конфиге', function () {
        $sender = accountAged(500);
        sendSame($sender, 'Продаю дёшево, пишите', 4);
        $this->travel(25)->hours();

        $fifth = MessagingFixtures::conversation(buyer: $sender);
        expect(app(SpamDetector::class)->detect($sender, $fifth, 'Продаю дёшево, пишите'))->toBe([]);
    });

    it('чужие сообщения с тем же текстом не считаются', function () {
        foreach (range(1, 4) as $ignored) {
            $other = accountAged(500);
            app(SendMessage::class)->handle($other, MessagingFixtures::conversation(buyer: $other), 'Здравствуйте, ещё продаётся?');
        }

        $sender = accountAged(500);
        $conversation = MessagingFixtures::conversation(buyer: $sender);
        expect(app(SpamDetector::class)->detect($sender, $conversation, 'Здравствуйте, ещё продаётся?'))->toBe([]);
    });

    it('порог — в конфиге', function () {
        config(['messaging.spam.same_text_chats' => 2]);
        $sender = accountAged(500);
        sendSame($sender, 'Привет', 1);

        $second = MessagingFixtures::conversation(buyer: $sender);
        expect(app(SpamDetector::class)->detect($sender, $second, 'Привет'))->toBe([SpamSignal::SameTextManyChats]);
        expect(Message::query()->count())->toBe(1);
    });
});

it('несколько признаков возвращаются вместе', function () {
    expect(detect(accountAged(1), 'Пишите в телеграм: https://t.me/fast_deal'))
        ->toContain(SpamSignal::NewAccountLink)
        ->toContain(SpamSignal::MessengerRequest);
});
