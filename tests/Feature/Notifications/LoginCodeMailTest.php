<?php

declare(strict_types=1);

use App\Domain\Accounts\Mail\LoginCodeMail;

// 4.4.1: письмо с кодом входа на теме ДС по макету «Письма и уведомления»; служебное — без отписки.

beforeEach(function () {
    config(['app.url' => 'https://yamuzykant.test']);
});

it('состав письма с кодом совпадает с макетом', function () {
    $mail = new LoginCodeMail('482193');

    $mail->assertSeeInOrderInHtml([
        'ЯМузыкант',
        'Код для входа на ЯМузыканте',
        'Введите этот код на странице входа. Он действует 10 мин.',
        '482193',
        'Если вы не входили',
        'Сотрудники ЯМузыканта никогда не спрашивают код.',
        'не просит данные карты',
        'Письмо о входе в аккаунт',
    ]);
});

it('тема письма — без кода: тема видна в превью и журналах почтовых систем', function () {
    $mail = new LoginCodeMail('482193');

    $mail->assertHasSubject('Код для входа на ЯМузыканте');
    expect($mail->envelope()->subject)->not->toContain('482193');
});

it('тема ДС: Wordmark, акцентный цвет, Onest с запасными шрифтами', function () {
    $html = (new LoginCodeMail('482193'))->render();

    expect($html)->toContain('Onest', 'system-ui', 'ym-wordmark', '#2fd67b');
});

it('служебное письмо без ссылки отписки', function () {
    $mail = new LoginCodeMail('482193');

    $mail->assertDontSeeInHtml('Отписаться');
    expect($mail->headers()->text)->not->toHaveKey('List-Unsubscribe');
});
