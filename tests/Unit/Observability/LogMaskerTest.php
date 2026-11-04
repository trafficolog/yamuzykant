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

    expect($out->message)->not->toContain('anna.petrova');
    expect($out->message)->not->toContain('example.com');
});

it('маскирует код входа в тексте и в полях контекста по имени ключа', function () {
    $out = (new MaskingProcessor)(makeRecord('Отправлен код: 482913', [
        'code' => '482913',
        'login_code' => '112233',
        'nested' => ['otp' => '998877', 'safe' => 'value'],
    ]));
    $context = json_encode($out->context);

    expect($out->message)->not->toContain('482913');
    expect($context)->not->toContain('482913');
    expect($context)->not->toContain('112233');
    expect($context)->not->toContain('998877');
    expect($out->context['nested']['safe'])->toBe('value');
});

it('маскирует серийный номер и токены', function () {
    $out = (new MaskingProcessor)(makeRecord('Серийный номер: A12345678, Authorization: Bearer abc.def-123', [
        'serial_number' => 'S/N 99887766',
        'api_token' => 'tok_live_1234567890',
        'password' => 'qwerty',
    ]));
    $dump = $out->message.json_encode($out->context);

    foreach (['A12345678', 'abc.def-123', '99887766', 'tok_live_1234567890', 'qwerty'] as $secret) {
        expect($dump)->not->toContain($secret);
    }
});

it('маскирует e-mail в тексте исключения из контекста', function () {
    $e = new RuntimeException('Не доставлено письмо на boris@example.org');
    $out = (new MaskingProcessor)(makeRecord('Ошибка', ['exception' => $e]));
    $dump = json_encode($out->context, JSON_UNESCAPED_UNICODE);

    expect($dump)->not->toContain('boris@example.org');
    expect($dump)->toContain('RuntimeException');
});

it('маскирует поле extra и не трогает безопасные сообщения', function () {
    $out = (new MaskingProcessor)(makeRecord('Заказ 12345 оформлен', [], ['user' => 'clara@example.net']));

    expect($out->message)->toBe('Заказ 12345 оформлен');
    expect(json_encode($out->extra))->not->toContain('clara@example.net');
});

it('LogMasker маскирует произвольные структуры для Sentry и логов', function () {
    $masked = json_encode((new LogMasker)->maskValue(['email' => 'a@b.ru', 'list' => ['x@y.com', 5, null, true]]));

    expect($masked)->not->toContain('a@b.ru');
    expect($masked)->not->toContain('x@y.com');
});
