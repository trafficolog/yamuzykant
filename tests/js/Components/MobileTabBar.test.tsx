import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import MobileTabBar from '@/Components/MobileTabBar';
import { ru } from '@/lang/ru';

const bar = () => screen.getByRole('navigation', { name: 'Нижнее меню' });
const tabs = () => within(bar()).getAllByRole('link');
const text = (element: Element): string => (element.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('MobileTabBar', () => {
    it('навигация «Нижнее меню» с пятью вкладками в порядке карточки 6.1.1', () => {
        render(<MobileTabBar />);

        expect(tabs().map(text)).toEqual(['Главная', 'Поиск', 'Продать', 'Сообщения', 'Кабинет']);
    });

    it('«Главная» ведёт на /, «Поиск» — в выдачу Барахолки, остальные пока на «#»', () => {
        render(<MobileTabBar />);

        const hrefs = Object.fromEntries(
            tabs().map((tab) => [text(tab), tab.getAttribute('href')]),
        );
        expect(hrefs).toEqual({
            Главная: '/',
            Поиск: '/baraholka',
            Продать: '#',
            Сообщения: '#',
            Кабинет: '#',
        });
    });

    it('активная вкладка помечена aria-current="page", остальные нет', () => {
        render(<MobileTabBar active="search" />);

        const current = tabs().filter((tab) => tab.getAttribute('aria-current') === 'page');
        expect(current.map(text)).toEqual(['Поиск']);
    });

    it('без active ни одна вкладка не помечена', () => {
        render(<MobileTabBar />);

        expect(bar().querySelector('[aria-current]')).toBeNull();
    });

    it('счётчик непрочитанных сообщений входит в имя ссылки', () => {
        render(<MobileTabBar messages={3} />);

        expect(within(bar()).getByRole('link', { name: 'Сообщения, 3' })).toBeInTheDocument();
    });

    it('без сообщений счётчик скрыт', () => {
        render(<MobileTabBar messages={0} />);

        expect(within(bar()).getByRole('link', { name: 'Сообщения' })).toBeInTheDocument();
        expect(bar().querySelector('.ym-iconbtn__count')).toBeNull();
    });

    it('больше 99 сообщений показываются как «99+»', () => {
        render(<MobileTabBar messages={120} />);

        expect(within(bar()).getByRole('link', { name: 'Сообщения, 99+' })).toBeInTheDocument();
    });

    it('у каждой вкладки есть иконка и видимая подпись; слов вне словаря нет', () => {
        render(<MobileTabBar />);

        for (const tab of tabs()) {
            expect(tab.querySelector('svg')).not.toBeNull();
            expect(text(tab).length).toBeGreaterThan(0);
        }
        expect(document.body.textContent).not.toMatch(/гир/i);
    });

    it('подпись вкладки «Сообщения» со счётчиком берётся из словаря lang/ru.ts', () => {
        expect(ru.tabBar.messagesLabel('3')).toBe('Сообщения, 3');
        expect(ru.tabBar.messagesLabel('99+')).toBe('Сообщения, 99+');
    });

    it('в разметке панели нет склейки подписи шаблонной строкой (aria-label берётся из lang)', () => {
        // Vitest запускается из корня репозитория; в jsdom import.meta.url не file:-URL.
        const source = readFileSync(
            join(process.cwd(), 'resources/js/Components/MobileTabBar.tsx'),
            'utf8',
        );

        expect(source).not.toMatch(/aria-label=\{`/);
        expect(source).not.toMatch(/aria-label=\{[^}]*`/);
    });
});
