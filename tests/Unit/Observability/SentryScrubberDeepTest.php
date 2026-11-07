<?php

declare(strict_types=1);

use App\Support\Observability\SentryScrubber;
use Sentry\Event;
use Sentry\ExceptionDataBag;
use Sentry\Frame;
use Sentry\Stacktrace;
use Tests\TestCase;

uses()->group(TestCase::NO_DATABASE_GROUP);

it('beforeSend очищает vars стек-фреймов, теги и контексты', function () {
    $frame = new Frame('login', 'app/Login.php', 10, null, null, [
        'email' => 'anna@example.com',
        'password' => 'hunter2hunter2',
        'note' => 'письмо anna@example.com',
    ]);
    $bag = new ExceptionDataBag(new RuntimeException('boom'), new Stacktrace([$frame]));

    $event = Event::createEvent();
    $event->setExceptions([$bag]);
    $event->setTags(['request_id' => 'req-12345678', 'user_email' => 'anna@example.com']);
    $event->setContext('job', ['payload' => 'to boris@example.org', 'api_token' => 'tok_secret_value']);

    $result = SentryScrubber::beforeSend($event, null);

    $vars = $result->getExceptions()[0]->getStacktrace()?->getFrames()[0]->getVars();
    $dump = json_encode([$vars, $result->getTags(), $result->getContexts()], JSON_UNESCAPED_UNICODE);

    expect($dump)->not->toContain('anna@example.com');
    expect($dump)->not->toContain('hunter2hunter2');
    expect($dump)->not->toContain('boris@example.org');
    expect($dump)->not->toContain('tok_secret_value');
    expect($result->getTags()['request_id'])->toBe('req-12345678');
});
