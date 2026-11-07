<?php

declare(strict_types=1);

use App\Domain\Messaging\MessageBody;

// Текст сообщения: обрезка пробелов, единые переводы строк, без управляющих символов.

it('обрезает пробелы по краям и приводит переводы строк к \n', function () {
    expect(MessageBody::normalize("  Привет\r\nкак дела?\rвсё ок  "))->toBe("Привет\nкак дела?\nвсё ок");
});

it('убирает управляющие и невидимые символы направления текста, табуляцию оставляет', function () {
    expect(MessageBody::normalize("a\u{0000}b\u{0007}c\td\u{202E}e\u{200B}f"))->toBe("abc\tdef");
});

it('схлопывает больше двух пустых строк подряд', function () {
    expect(MessageBody::normalize("раз\n\n\n\n\nдва"))->toBe("раз\n\nдва");
});

it('HTML не трогает: экранирование — задача отображения', function () {
    expect(MessageBody::normalize('<b>жирный</b> & "кавычки"'))->toBe('<b>жирный</b> & "кавычки"');
});

it('пустой после нормализации текст и текст длиннее лимита отклоняются', function () {
    expect(fn () => MessageBody::from(" \n "))->toThrow(InvalidArgumentException::class)
        ->and(fn () => MessageBody::from(str_repeat('я', 2001), 2000))->toThrow(InvalidArgumentException::class)
        ->and(MessageBody::from(str_repeat('я', 2000), 2000)->value)->toHaveLength(2000);
});
