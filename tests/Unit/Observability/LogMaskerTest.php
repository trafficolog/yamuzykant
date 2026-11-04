<?php

declare(strict_types=1);

use App\Support\Observability\LogMasker;
use App\Support\Observability\MaskingProcessor;
use Monolog\Level;
use Monolog\LogRecord;
use Tests\TestCase;

// Маскирование не обращается к БД.
uses()->group(TestCase::NO_DATABASE_GROUP);

/**
 * @param  array<string, mixed>  $context
 * @param  array<string, mixed>  $extra
 */
function makeRecord(string $message, array $context = [], array $extra = []): LogRecord
{
    return new LogRecord(new DateTimeImmutable, 'testing', Level::Info, $message, $context, $extra);
}

it('маскирует e-mail в тексте сообщения', function () {
    $out = (new MaskingProcessor)(makeRecord('Вход anna.petrova+test@example.com не удался'));

    expect($out->message)->not->toContain('anna.petrova')->not->toContain('example.com');
});

it('маскирует код входа в тексте и в полях контекста по имени ключа', function () {
    $out = (new MaskingProcessor)(makeRecord('Отправлен код: 482913', [
        'code' => '482913',
        'login_code' => '112233',
        'nested' => ['otp' => '998877', 'safe' => 'value'],
    ]));

    expect($out->message)->not->toContain('482913')
        ->and(json_encode($out->context))->not->toContain('482913')->not->toContain('112233')->not->toContain('998877')
        ->and($out->context['nested']['safe'])->toBe('value');
});

it('маскирует серийный номер и токены', function () {
    $out = (new MaskingProcessor)(makeRecord('Серийный номер: A12345678, Authorization: Bearer abc.def-123', [
        'serial_number' => 'S/N 99887766',
        'api_token' => 'tok_live_1234567890',
        'password' => 'qwerty',
    ]));

    $dump = $out->message.json_encode($out->context);
    expect($dump)->not->toContain('A12345678')->not->toContain('abc.def-123')
        ->not->toContain('99887766')->not->toContain('tok_live_1234567890')->not->toContain('qwerty');
});

it('маскирует e-mail в тексте исключения из контекста', function () {
    $e = new RuntimeException('Не доставлено письмо на boris@example.org');
    $out = (new MaskingProcessor)(makeRecord('Ошибка', ['exception' => $e]));

    $dump = json_encode($out->context, JSON_UNESCAPED_UNICODE);
    expect($dump)->not->toContain('boris@example.org')->toContain('RuntimeException');
});

it('маскирует поле extra и не трогает безопасные сообщения', function () {
    $out = (new MaskingProcessor)(makeRecord('Заказ 12345 оформлен', [], ['user' => 'clara@example.net']));

    expect($out->message)->toBe('Заказ 12345 оформлен')
        ->and(json_encode($out->extra))->not->toContain('clara@example.net');
});

it('LogMasker маскирует произвольные структуры для Sentry и логов', function () {
    $masked = (new LogMasker)->maskValue(['email' => 'a@b.ru', 'list' => ['x@y.com', 5, null, true]]);

    expect(json_encode($masked))->not->toContain('a@b.ru')->not->toContain('x@y.com');
});
