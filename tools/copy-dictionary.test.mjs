// Тесты словаря копирайтинга и выбора маршрутов для copy.spec.ts (карточка 0.2.2).
// Запуск: node --test tools/copy-dictionary.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findForbidden, pickRoutes } from './copy-dictionary.mjs';

const words = (text) => findForbidden(text).map((h) => h.word);

test('findForbidden находит запрещённое слово в тексте страницы', () => {
    assert.deepEqual(words('ЯМузыкант\nВаш сетап готов'), ['сетап']);
});

test('findForbidden не ловит слова, в которых запрещённый корень только часть', () => {
    assert.deepEqual(words('Гитара, гирлянда, гиря, ЯМузыкант, инструменты'), []);
});

test('findForbidden нечувствителен к регистру и пробелам в фразах', () => {
    assert.ok(words('Мой   ГИР').includes('мой гир'));
    assert.deepEqual(words('По  рукам'), ['по рукам']);
});

test('findForbidden ловит «Ля 440» и «Ля440» (неразрывный пробел тоже)', () => {
    assert.deepEqual(words('Ля440'), ['ля440']);
    assert.deepEqual(words('Ля 440'), ['ля440']);
});

test('«Ля440» с левой границей слова: без ложных срабатываний внутри слов', () => {
    assert.deepEqual(words('для 440 Гц'), []);
    assert.deepEqual(words('земля 440'), []);
    assert.deepEqual(words('Земля440'), []);
});

test('«Ля440» с левой границей: срабатывает в начале строки, после пробела, знака и NBSP', () => {
    for (const text of ['Ля440', 'ля 440', 'Ля 440', 'ЛЯ 440', 'Цена: Ля440', 'Цена (Ля440)', 'цена Ля440']) {
        assert.deepEqual(words(text), ['ля440'], text);
    }
});

test('findForbidden ловит формы слова «гир»', () => {
    for (const text of ['гирами', 'гиров', 'гирах', 'гиру', 'гира', 'гирам']) {
        assert.ok(words(text).includes('гир'), text);
    }
});

test('findForbidden не ловит «гир» внутри других слов', () => {
    assert.deepEqual(words('гитара, гирлянда, гиря, гирокомпас'), []);
});

test('findForbidden ловит «Кофр-доставка» с U+2011 и с пробелом', () => {
    assert.deepEqual(words('Кофр‑доставка'), ['кофр-доставка']);
    assert.deepEqual(words('Кофр доставка'), ['кофр-доставка']);
    assert.deepEqual(words('Кофр-доставка'), ['кофр-доставка']);
});

test('findForbidden ловит бренд-варианты ЯМузыканта', () => {
    assert.deepEqual(words('Ладмастер и Ладмир'), ['ладмастер', 'ладмир']);
});

test('pickRoutes: только публичные GET-маршруты без служебных, параметров и auth', () => {
    const list = [
        { method: 'GET|HEAD', uri: '/', middleware: ['web'] },
        { method: 'GET|HEAD', uri: 'health', middleware: ['api'] },
        { method: 'GET|HEAD', uri: '_ds', middleware: ['web'] },
        { method: 'GET|HEAD', uri: '_ignition/health-check' },
        { method: 'GET|HEAD', uri: 'up' },
        { method: 'GET|HEAD', uri: 'api/lots' },
        { method: 'GET|HEAD', uri: 'storage/{path}' },
        { method: 'GET|HEAD', uri: 'lots/{lot}', middleware: ['web'] },
        { method: 'GET|HEAD', uri: 'account', middleware: ['web', 'auth'] },
        { method: 'POST', uri: 'login', middleware: ['web'] },
        { method: 'GET|HEAD', uri: 'help', middleware: ['web'] },
    ];
    assert.deepEqual(pickRoutes(list), ['/', '/help']);
});

test('pickRoutes: маршруты без ведущего слеша получают его, дубли убираются', () => {
    const list = [
        { method: 'GET|HEAD', uri: 'help' },
        { method: 'GET|HEAD', uri: 'help' },
    ];
    assert.deepEqual(pickRoutes(list), ['/help']);
});
