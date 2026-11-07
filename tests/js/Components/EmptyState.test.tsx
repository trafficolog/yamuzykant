import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import EmptyState from '@/Components/EmptyState';

// Пустое состояние по ДС: иконка 40 px в круге surface-recessed, одно предложение, необязательная кнопка outline.

describe('EmptyState', () => {
    it('показывает текст и иконку без кнопки', () => {
        const { container } = render(<EmptyState icon="search">Здесь пока пусто.</EmptyState>);

        expect(screen.getByText('Здесь пока пусто.')).toBeInTheDocument();
        expect(container.querySelector('.ym-empty__icon svg')).not.toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('кнопка действия вызывает обработчик', () => {
        const onClick = vi.fn();
        render(
            <EmptyState icon="search" action={{ label: 'Сбросить фильтры', onClick }}>
                Лотов нет.
            </EmptyState>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));

        expect(onClick).toHaveBeenCalledOnce();
    });

    it('иконка декоративная — скрыта от диктора', () => {
        const { container } = render(<EmptyState icon="search">Пусто.</EmptyState>);

        expect(container.querySelector('.ym-empty__icon')).toHaveAttribute('aria-hidden', 'true');
    });
});
