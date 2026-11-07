import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Скрипт «Войти до гидратации» — статический файл (CSP script-src 'self'): public/js/pending-login.js.
const SOURCE = readFileSync(join(process.cwd(), 'public/js/pending-login.js'), 'utf8');

const listeners: Array<[string, EventListenerOrEventListenerObject]> = [];
const realAdd = document.addEventListener.bind(document);

beforeEach(() => {
    document.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.push([type, listener]);
        realAdd(type, listener);
    }) as typeof document.addEventListener;
    document.body.innerHTML =
        '<button data-login-trigger id="login">Войти</button><button id="other">Другая</button>';
    delete document.documentElement.dataset.hydrated;
    delete (window as { __ymLoginPending?: boolean }).__ymLoginPending;
    new Function(SOURCE)();
});

afterEach(() => {
    for (const [type, listener] of listeners.splice(0))
        document.removeEventListener(type, listener);
    document.addEventListener = realAdd;
});

const click = (id: string): MouseEvent => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById(id)?.dispatchEvent(event);
    return event;
};

describe('public/js/pending-login.js', () => {
    it('до гидратации клик по [data-login-trigger] запоминается и не выполняет действие по умолчанию', () => {
        const event = click('login');

        expect((window as { __ymLoginPending?: boolean }).__ymLoginPending).toBe(true);
        expect(event.defaultPrevented).toBe(true);
    });

    it('клик по другим элементам не запоминается', () => {
        const event = click('other');

        expect((window as { __ymLoginPending?: boolean }).__ymLoginPending).toBeUndefined();
        expect(event.defaultPrevented).toBe(false);
    });

    it('после гидратации скрипт не вмешивается', () => {
        document.documentElement.dataset.hydrated = 'true';

        const event = click('login');

        expect((window as { __ymLoginPending?: boolean }).__ymLoginPending).toBeUndefined();
        expect(event.defaultPrevented).toBe(false);
    });
});
