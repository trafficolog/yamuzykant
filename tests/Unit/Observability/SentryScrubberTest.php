<?php

declare(strict_types=1);

use App\Support\Observability\SentryScrubber;
use Sentry\Event;
use Sentry\UserDataBag;
use Tests\TestCase;

uses()->group(TestCase::NO_DATABASE_GROUP);

it('beforeSend убирает ПДн: e-mail, IP, куки, тело запроса, код входа', function () {
    $user = UserDataBag::createFromUserIdentifier('42');
    $user->setEmail('anna@example.com');
    $user->setIpAddress('203.0.113.5');

    $event = Event::createEvent();
    $event->setMessage('Не вышло войти anna@example.com');
    $event->setUser($user);
    $event->setRequest([
        'url' => 'https://stage.example.test/auth/email/verify',
        'cookies' => ['ym_session' => 'secret'],
        'headers' => ['Cookie' => 'ym_session=secret', 'Authorization' => 'Bearer abc', 'X-Request-Id' => 'r1'],
        'data' => ['email' => 'anna@example.com', 'code' => '123456'],
        'query_string' => 'email=anna@example.com',
    ]);
    $event->setExtra(['code' => '123456', 'note' => 'письмо anna@example.com']);

    $result = SentryScrubber::beforeSend($event, null);

    expect($result)->not->toBeNull();
    $dump = json_encode([
        $result->getMessage(), $result->getUser()?->getEmail(), $result->getUser()?->getIpAddress(),
        $result->getRequest(), $result->getExtra(),
    ], JSON_UNESCAPED_UNICODE);

    expect($dump)->not->toContain('anna@example.com')->not->toContain('123456')
        ->not->toContain('203.0.113.5')->not->toContain('ym_session=secret')->not->toContain('Bearer abc')
        ->and($result->getRequest()['headers']['X-Request-Id'] ?? null)->toBe('r1')
        ->and($result->getUser()?->getId())->toBe('42');
});
