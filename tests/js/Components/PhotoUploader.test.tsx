import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PhotoUploader from '@/Components/PhotoUploader';
import type { ListingPhoto, PhotoApi, UploadTicket } from '@/Components/photoUploaderApi';
import { PhotoApiError } from '@/Components/photoUploaderApi';
import { ru } from '@/lang/ru';

const LISTING = '9f1c2c1e-0000-4000-8000-000000000001';

function photo(id: number, overrides: Partial<ListingPhoto> = {}): ListingPhoto {
    return {
        id,
        position: id - 1,
        is_serial: false,
        state: 'ready',
        error: null,
        urls: {
            square: {
                avif: `/media/photos/${id}/square.avif`,
                webp: `/media/photos/${id}/square.webp`,
            },
            wide: { avif: `/media/photos/${id}/wide.avif`, webp: `/media/photos/${id}/wide.webp` },
        },
        ...overrides,
    };
}

const TICKET: UploadTicket = {
    upload_id: 'u-1',
    url: 'http://s3.test/put',
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    expires_at: '2026-11-04T12:05:00Z',
};

function fakeApi(overrides: Partial<PhotoApi> = {}): PhotoApi {
    return {
        list: vi.fn(() => Promise.resolve([])),
        requestUpload: vi.fn(() => Promise.resolve(TICKET)),
        put: vi.fn(() => Promise.resolve()),
        confirm: vi.fn(() => Promise.resolve(photo(1, { state: 'processing', urls: null }))),
        remove: vi.fn(() => Promise.resolve([])),
        reorder: vi.fn((_listing: string, ids: number[]) =>
            Promise.resolve(ids.map((id, position) => photo(id, { position }))),
        ),
        ...overrides,
    };
}

const jpeg = (name = 'strat.jpg', size = 2_000_000) => {
    const file = new File(['x'], name, { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: size });
    return file;
};

const cells = () => screen.getAllByRole('listitem');
const cell = (index: number): HTMLElement => {
    const element = cells()[index];
    if (!element) throw new Error(`Нет ячейки ${index}`);
    return element;
};
const fileInput = () => screen.getByTestId('photo-input') as HTMLInputElement;

beforeEach(() => {
    vi.useRealTimers();
});

describe('PhotoUploader: пустое состояние', () => {
    it('6 ячеек из макета, первая — «Серийный номер» с пометкой «обязательно»', () => {
        render(<PhotoUploader listingId={LISTING} api={fakeApi()} />);

        expect(cells()).toHaveLength(6);
        const first = within(cell(0));
        expect(
            first.getByRole('button', { name: 'Добавить фото: Серийный номер' }),
        ).toBeInTheDocument();
        expect(first.getByText('обязательно')).toBeInTheDocument();
        expect(screen.getAllByText('обязательно')).toHaveLength(1);

        const labels = [
            'Общий вид',
            'Корпус крупно',
            'Гриф и лады',
            'Электроника',
            'Кейс и комплект',
        ];
        labels.forEach((label, index) => {
            expect(
                within(cell(index + 1)).getByRole('button', {
                    name: `Добавить фото: ${label}`,
                }),
            ).toBeInTheDocument();
        });
    });

    it('подсказывает, чего не хватает', () => {
        render(<PhotoUploader listingId={LISTING} api={fakeApi()} />);

        expect(screen.getByRole('status')).toHaveTextContent(
            'Добавьте: ещё 3 фото, фото серийного номера.',
        );
    });
});

describe('PhotoUploader: загрузка', () => {
    it('серийная ячейка: прогресс, затем обработка, затем фото', async () => {
        let progress: (percent: number) => void = () => undefined;
        let finishPut: () => void = () => undefined;
        const api = fakeApi({
            put: vi.fn((_ticket: UploadTicket, _file: File, onProgress: (p: number) => void) => {
                progress = onProgress;
                return new Promise<void>((resolve) => {
                    finishPut = resolve;
                });
            }),
            confirm: vi.fn(() =>
                Promise.resolve(photo(7, { is_serial: true, state: 'processing', urls: null })),
            ),
            list: vi.fn(() => Promise.resolve([photo(7, { is_serial: true })])),
        });
        render(<PhotoUploader listingId={LISTING} api={api} pollInterval={10} />);

        fireEvent.click(screen.getByRole('button', { name: 'Добавить фото: Серийный номер' }));
        fireEvent.change(fileInput(), { target: { files: [jpeg()] } });

        await waitFor(() => expect(api.put).toHaveBeenCalled());
        act(() => progress(40));
        const bar = within(cell(0)).getByRole('progressbar');
        expect(bar).toHaveAttribute('aria-valuenow', '40');

        act(() => finishPut());
        await waitFor(() => expect(api.confirm).toHaveBeenCalledWith(LISTING, 'u-1', true));
        expect(api.requestUpload).toHaveBeenCalledWith(LISTING, expect.any(File));

        await waitFor(() =>
            expect(
                within(cell(0)).getByRole('img', { name: 'Фото серийного номера' }),
            ).toBeInTheDocument(),
        );
        expect(api.list).toHaveBeenCalled();
    });

    it('drag-and-drop файла в пустую ячейку загружает его', async () => {
        const api = fakeApi({
            confirm: vi.fn(() => Promise.resolve(photo(2))),
        });
        render(<PhotoUploader listingId={LISTING} api={api} />);

        fireEvent.drop(cell(1), { dataTransfer: { files: [jpeg()], types: ['Files'] } });

        await waitFor(() => expect(api.confirm).toHaveBeenCalledWith(LISTING, 'u-1', false));
        await waitFor(() =>
            expect(screen.getByRole('img', { name: 'Фото 1' })).toBeInTheDocument(),
        );
    });

    it('PDF не отправляется: ошибка в ячейке', async () => {
        const api = fakeApi();
        render(<PhotoUploader listingId={LISTING} api={api} />);

        fireEvent.click(screen.getByRole('button', { name: 'Добавить фото: Общий вид' }));
        fireEvent.change(fileInput(), {
            target: { files: [new File(['%PDF'], 'scan.pdf', { type: 'application/pdf' })] },
        });

        expect(await screen.findByRole('alert')).toHaveTextContent(ru.photos.errors.type);
        expect(api.requestUpload).not.toHaveBeenCalled();
    });

    it('файл больше 15 МБ не отправляется', async () => {
        const api = fakeApi();
        render(<PhotoUploader listingId={LISTING} api={api} />);

        fireEvent.drop(cell(2), {
            dataTransfer: { files: [jpeg('big.jpg', 15 * 1024 * 1024 + 1)], types: ['Files'] },
        });

        expect(await screen.findByRole('alert')).toHaveTextContent(ru.photos.errors.size);
        expect(api.requestUpload).not.toHaveBeenCalled();
    });

    it('ошибка сервера показывается текстом сервера', async () => {
        const api = fakeApi({
            confirm: vi.fn(() =>
                Promise.reject(
                    new PhotoApiError('Это не фото. Загрузите файл в формате JPEG, PNG или HEIC.'),
                ),
            ),
        });
        render(<PhotoUploader listingId={LISTING} api={api} />);

        fireEvent.drop(cell(1), { dataTransfer: { files: [jpeg()], types: ['Files'] } });

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Это не фото. Загрузите файл в формате JPEG, PNG или HEIC.',
        );
    });

    it('сбой сети — общая ошибка', async () => {
        const api = fakeApi({ put: vi.fn(() => Promise.reject(new Error('network'))) });
        render(<PhotoUploader listingId={LISTING} api={api} />);

        fireEvent.drop(cell(1), { dataTransfer: { files: [jpeg()], types: ['Files'] } });

        expect(await screen.findByRole('alert')).toHaveTextContent(ru.photos.errors.network);
    });

    it('ошибка обработки на сервере показывается в ячейке', () => {
        render(
            <PhotoUploader
                listingId={LISTING}
                api={fakeApi()}
                initialPhotos={[
                    photo(1, {
                        state: 'failed',
                        urls: null,
                        error: 'Не удалось обработать фото. Загрузите другое.',
                    }),
                ]}
            />,
        );

        expect(screen.getByRole('alert')).toHaveTextContent(
            'Не удалось обработать фото. Загрузите другое.',
        );
    });
});

describe('PhotoUploader: порядок, удаление, лимиты', () => {
    const three = () => [photo(1, { is_serial: true }), photo(2), photo(3)];

    it('удаляет фото', async () => {
        const api = fakeApi({
            remove: vi.fn(() =>
                Promise.resolve([photo(1, { is_serial: true }), photo(3, { position: 1 })]),
            ),
        });
        render(<PhotoUploader listingId={LISTING} api={api} initialPhotos={three()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Удалить фото 2' }));

        await waitFor(() => expect(api.remove).toHaveBeenCalledWith(LISTING, 2));
        await waitFor(() => expect(screen.queryByRole('img', { name: 'Фото 3' })).toBeNull());
        expect(screen.getByRole('img', { name: 'Фото 2' })).toBeInTheDocument();
    });

    it('клавиатура: кнопка «Сдвинуть вправо» меняет порядок, фокус остаётся на фото', async () => {
        const api = fakeApi();
        render(<PhotoUploader listingId={LISTING} api={api} initialPhotos={three()} />);

        const move = screen.getByRole('button', { name: 'Сдвинуть фото 2 вправо' });
        move.focus();
        fireEvent.click(move);

        await waitFor(() => expect(api.reorder).toHaveBeenCalledWith(LISTING, [1, 3, 2]));
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Сдвинуть фото 3 влево' })).toHaveFocus(),
        );
    });

    it('у крайних фото нет лишних кнопок сдвига; серийное не сдвигается', () => {
        render(<PhotoUploader listingId={LISTING} api={fakeApi()} initialPhotos={three()} />);

        expect(screen.queryByRole('button', { name: /Сдвинуть фото серийного номера/ })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Сдвинуть фото 2 влево' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Сдвинуть фото 3 вправо' })).toBeNull();
    });

    it('drag-and-drop фото на другое фото меняет порядок', async () => {
        const api = fakeApi();
        render(<PhotoUploader listingId={LISTING} api={api} initialPhotos={three()} />);

        const from = cell(1);
        const to = cell(2);
        const store: Record<string, string> = {};
        const dataTransfer = {
            setData: (type: string, value: string) => {
                store[type] = value;
            },
            getData: (type: string) => store[type] ?? '',
            types: ['application/x-ym-photo'],
            files: [],
            effectAllowed: 'move',
            dropEffect: 'move',
        };
        fireEvent.dragStart(from, { dataTransfer });
        fireEvent.dragOver(to, { dataTransfer });
        fireEvent.drop(to, { dataTransfer });

        await waitFor(() => expect(api.reorder).toHaveBeenCalledWith(LISTING, [1, 3, 2]));
    });

    it('3 фото с серийным — подсказки нет', () => {
        render(<PhotoUploader listingId={LISTING} api={fakeApi()} initialPhotos={three()} />);

        expect(screen.getByRole('status')).toHaveTextContent('');
    });

    it('после 6 ячеек — ячейка «Ещё фото», при 12 фото добавить нельзя', () => {
        const six = [photo(1, { is_serial: true }), ...[2, 3, 4, 5, 6].map((id) => photo(id))];
        const { unmount } = render(
            <PhotoUploader listingId={LISTING} api={fakeApi()} initialPhotos={six} />,
        );
        expect(screen.getByRole('button', { name: 'Добавить фото: Ещё фото' })).toBeInTheDocument();
        unmount();

        const twelve = [
            photo(1, { is_serial: true }),
            ...Array.from({ length: 11 }, (_, i) => photo(i + 2)),
        ];
        render(<PhotoUploader listingId={LISTING} api={fakeApi()} initialPhotos={twelve} />);
        expect(screen.queryByRole('button', { name: /Добавить фото/ })).toBeNull();
        expect(cells()).toHaveLength(12);
        expect(screen.getByText(ru.photos.limitReached)).toBeInTheDocument();
    });

    it('много файлов сразу — берутся только до лимита 12', async () => {
        const ten = [
            photo(1, { is_serial: true }),
            ...Array.from({ length: 9 }, (_, i) => photo(i + 2)),
        ];
        let next = 90;
        const api = fakeApi({ confirm: vi.fn(() => Promise.resolve(photo((next += 1)))) });
        render(<PhotoUploader listingId={LISTING} api={api} initialPhotos={ten} />);

        fireEvent.drop(
            screen
                .getByRole('button', { name: 'Добавить фото: Ещё фото' })
                .closest('li') as HTMLElement,
            {
                dataTransfer: {
                    files: [jpeg('a.jpg'), jpeg('b.jpg'), jpeg('c.jpg')],
                    types: ['Files'],
                },
            },
        );

        await waitFor(() => expect(api.confirm).toHaveBeenCalledTimes(2));
    });
});
