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

it('убирает невидимые символы, которыми маскируют ссылки и контакты', function (string $char) {
    expect(MessageBody::normalize("a{$char}b"))->toBe('ab');
})->with([
    'U+061C ALM' => "\u{061C}",
    'U+2060 word joiner' => "\u{2060}",
    'U+2064 invisible plus' => "\u{2064}",
    'U+206A' => "\u{206A}",
    'U+206F' => "\u{206F}",
    'U+00AD мягкий перенос' => "\u{00AD}",
    'U+034F' => "\u{034F}",
    'U+115F хангыль' => "\u{115F}",
    'U+1160 хангыль' => "\u{1160}",
    'U+3164 хангыль' => "\u{3164}",
    'U+FFA0 хангыль' => "\u{FFA0}",
    'U+180E монгольский разделитель' => "\u{180E}",
    'U+FFF9' => "\u{FFF9}",
    'U+FFFB' => "\u{FFFB}",
    'U+E0000 тег' => "\u{E0000}",
    'U+E0041 тег A' => "\u{E0041}",
    'U+E007F отмена тегов' => "\u{E007F}",
]);

it('теги Unicode (невидимый текст, ASCII smuggling) убираются; флаги-подразделения становятся чёрным флагом', function () {
    expect(MessageBody::normalize("ссылка\u{E0068}\u{E0074}\u{E0074}\u{E0070}"))->toBe('ссылка')
        // Осознанная цена: 🏴 + теги «gbeng» + отмена → просто 🏴.
        ->and(MessageBody::normalize("\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}"))->toBe("\u{1F3F4}");
});

it('U+2028 и U+2029 становятся переводом строки', function () {
    expect(MessageBody::normalize("раз\u{2028}два\u{2029}три"))->toBe("раз\nдва\nтри");
});

it('обычный текст и эмодзи не страдают от чистки невидимых символов', function () {
    expect(MessageBody::normalize('Привет 👍 ёлка №5'))->toBe('Привет 👍 ёлка №5');
});
