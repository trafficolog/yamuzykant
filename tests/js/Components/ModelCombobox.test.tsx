import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelCombobox, type ModelOption } from '@/Components/ModelCombobox';

const models: ModelOption[] = [
    {
        id: 1,
        brand: 'Fender',
        name: 'American Vintage ’57 Stratocaster',
        year_from: 2007,
        year_to: 2012,
        category_id: 10,
    },
    {
        id: 2,
        brand: 'Fender',
        name: 'Player Stratocaster',
        year_from: 2018,
        year_to: null,
        category_id: 10,
    },
];

function stubSearch(data: ModelOption[] = models) {
    const fetchMock = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    return fetchMock;
}

function renderCombobox(overrides: Partial<React.ComponentProps<typeof ModelCombobox>> = {}) {
    const props = {
        id: 'model',
        value: '',
        onChange: vi.fn(),
        onSelect: vi.fn(),
        ...overrides,
    };
    render(<ModelCombobox {...props} />);

    return { input: screen.getByRole('combobox'), ...props };
}

async function typeAndWaitForOptions(input: HTMLElement, text: string) {
    fireEvent.change(input, { target: { value: text } });
    await screen.findAllByRole('option');
}

function option(index: number): HTMLElement {
    const element = screen.getAllByRole('option')[index];
    if (!element) {
        throw new Error(`Нет варианта с индексом ${index}`);
    }

    return element;
}

describe('ModelCombobox', () => {
    beforeEach(() => {
        stubSearch();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('запрашивает /api/models?q= и показывает варианты в listbox', async () => {
        const fetchMock = stubSearch();
        const { input } = renderCombobox();

        await typeAndWaitForOptions(input, 'стратокастер');

        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
            `/api/models?q=${encodeURIComponent('стратокастер')}`,
        );
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        expect(input).toHaveAttribute('aria-expanded', 'true');
        expect(input).toHaveAttribute('aria-autocomplete', 'list');
    });

    it('ArrowDown выделяет следующий вариант и ставит aria-activedescendant', async () => {
        const { input } = renderCombobox();
        await typeAndWaitForOptions(input, 'stratocaster');

        fireEvent.keyDown(input, { key: 'ArrowDown' });
        expect(option(0)).toHaveAttribute('aria-selected', 'true');
        expect(input).toHaveAttribute('aria-activedescendant', option(0).id);

        fireEvent.keyDown(input, { key: 'ArrowDown' });
        expect(option(1)).toHaveAttribute('aria-selected', 'true');
        expect(input).toHaveAttribute('aria-activedescendant', option(1).id);
    });

    it('ArrowDown на последнем варианте и ArrowUp на первом не уходят за границы списка', async () => {
        const { input } = renderCombobox();
        await typeAndWaitForOptions(input, 'stratocaster');

        fireEvent.keyDown(input, { key: 'ArrowUp' });
        expect(option(0)).toHaveAttribute('aria-selected', 'true');

        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        expect(option(1)).toHaveAttribute('aria-selected', 'true');
    });

    it('Enter выбирает подсвеченную модель и закрывает список', async () => {
        const { input, onSelect } = renderCombobox();
        await typeAndWaitForOptions(input, 'stratocaster');

        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(onSelect).toHaveBeenCalledWith(models[1]);
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(input).toHaveAttribute('aria-expanded', 'false');
    });

    it('Enter без выделенного варианта не выбирает модель', async () => {
        const { input, onSelect } = renderCombobox();
        await typeAndWaitForOptions(input, 'stratocaster');

        fireEvent.keyDown(input, { key: 'Enter' });

        expect(onSelect).not.toHaveBeenCalled();
    });

    it('Escape закрывает список и оставляет введённый текст', async () => {
        const { input, onSelect } = renderCombobox();
        await typeAndWaitForOptions(input, 'stratocaster');

        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'Escape' });

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(input).toHaveAttribute('aria-expanded', 'false');
        expect(input).toHaveValue('stratocaster');
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('ввод без выбора отдаёт текст через onChange и не вызывает onSelect', async () => {
        const { input, onChange, onSelect } = renderCombobox();
        await typeAndWaitForOptions(input, 'Ibanez RG9999');

        expect(onChange).toHaveBeenLastCalledWith('Ibanez RG9999');
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('при пустом ответе показывает, что модель сохранится как введена', async () => {
        stubSearch([]);
        const { input } = renderCombobox();
        fireEvent.change(input, { target: { value: 'Ibanez RG9999' } });

        expect(await screen.findByText(/сохранится как введена/)).toBeInTheDocument();
    });
});
