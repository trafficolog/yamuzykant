<?php

declare(strict_types=1);

use App\Support\Observability\SentryScrubber;
use Sentry\Event;
use Sentry\ExceptionDataBag;
use Sentry\Frame;
use Sentry\Stacktrace;
use Tests\TestCase;

uses()->group(TestCase::NO_DATABASE_GROUP);

/**
 * @param  array<string, mixed>  $vars
 * @return array<string, mixed>
 */
function scrubbedVars(array $vars, bool $inApp): array
{
    $frame = new Frame('handle', 'app/X.php', 1, null, null, $vars, $inApp);
    $event = Event::createEvent();
    $event->setExceptions([new ExceptionDataBag(new RuntimeException('x'), new Stacktrace([$frame]))]);

    $result = SentryScrubber::beforeSend($event, null);

    return $result->getExceptions()[0]->getStacktrace()?->getFrames()[0]->getVars() ?? [];
}

it('в кадрах приложения произвольные строки заменяются описанием, а числа, bool, null, uuid и слова-статусы остаются', function () {
    $text = 'Продаю гитару, звоните на +7 900 123-45-67';
    $vars = scrubbedVars([
        'count' => 3,
        'ratio' => 0.5,
        'flag' => true,
        'nothing' => null,
        'listing' => '0198a1b2-1111-7222-8333-444455556666',
        'status' => 'published',
        'free_text' => $text,
        'plain_digits' => '123456',
    ], inApp: true);

    expect($vars['count'])->toBe(3)
        ->and($vars['ratio'])->toBe(0.5)
        ->and($vars['flag'])->toBeTrue()
        ->and($vars['nothing'])->toBeNull()
        ->and($vars['listing'])->toBe('0198a1b2-1111-7222-8333-444455556666')
        ->and($vars['status'])->toBe('published')
        ->and($vars['free_text'])->toBe('[string:'.strlen($text).']')
        ->and($vars['plain_digits'])->toBe('[string:6]');
});

it('вложенные массивы в кадрах приложения проходят тот же белый список', function () {
    $vars = scrubbedVars(['data' => ['name' => 'Анна Иванова', 'id' => 5]], inApp: true);

    expect($vars['data']['id'])->toBe(5)
        ->and($vars['data']['name'])->toStartWith('[string:');
});

it('в кадрах вендора строки только маскируются, диагностика не страдает', function () {
    $vars = scrubbedVars(['sql' => 'select * from listings', 'mail' => 'a@b.example'], inApp: false);

    expect($vars['sql'])->toBe('select * from listings')
        ->and($vars['mail'])->not->toContain('a@b.example');
});
