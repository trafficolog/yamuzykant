<?php

declare(strict_types=1);

use App\Domain\Accounts\Models\User;
use App\Domain\Messaging\Actions\SendMessage;
use App\Domain\Notifications\Mail\NewMessageMail;
use Tests\Support\MessagingFixtures;

// 4.4.1: письмо о новом сообщении — состав по макету, без почты собеседника и без текста сообщения (BR-04).

beforeEach(function () {
    config(['scout.driver' => 'null', 'app.url' => 'https://yamuzykant.test']);
});

/** @return array{0: NewMessageMail, 1: User, 2: User, 3: string} */
function newMessageMail(): array
{
    $seller = User::factory()->create(['name' => 'Андрей', 'email' => 'seller-private@example.test']);
    $buyer = User::factory()->create(['name' => 'Покупатель', 'email' => 'buyer-private@example.test']);
    $listing = MessagingFixtures::listing();
    $listing->user_id = $seller->id;
    $listing->title = 'Fender Stratocaster';
    $listing->price = 184500;
    $listing->save();
    $conversation = MessagingFixtures::conversation($listing, $buyer);

    $message = app(SendMessage::class)->handle($seller, $conversation, 'Секретный текст про Таганскую');

    return [new NewMessageMail($buyer, $message), $seller, $buyer, $conversation->id];
}

it('состав письма совпадает с макетом', function () {
    [$mail, , , $conversationId] = newMessageMail();

    $mail->assertSeeInOrderInHtml([
        'ЯМузыкант',
        'Новое сообщение от Андрея',
        'Fender Stratocaster',
        '184 500 ₽',
        'Ответить в чате',
        'Отвечайте только в чате ЯМузыканта',
        'Письмо о новых сообщениях',
        'Отписаться',
    ]);
    $mail->assertSeeInHtml("https://yamuzykant.test/messages/{$conversationId}");
    $mail->assertHasSubject('Новое сообщение от Андрея');
});

it('в письме нет почты собеседника, получателя и текста сообщения', function () {
    [$mail] = newMessageMail();

    $mail->assertDontSeeInHtml('seller-private@example.test')
        ->assertDontSeeInHtml('buyer-private@example.test')
        ->assertDontSeeInHtml('Секретный текст')
        ->assertDontSeeInText('Секретный текст');
});

it('отписка — подписанная ссылка в теле и в заголовках List-Unsubscribe (один клик)', function () {
    [$mail, , $buyer] = newMessageMail();

    $headers = $mail->headers()->text;
    expect($headers['List-Unsubscribe'])->toContain("/notifications/unsubscribe/{$buyer->id}/new_message", 'signature=')
        ->and($headers['List-Unsubscribe-Post'])->toBe('List-Unsubscribe=One-Click');

    $mail->assertSeeInHtml('/notifications/unsubscribe/'.$buyer->id.'/new_message');
});
