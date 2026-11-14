import { expect, type Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';

// Общее для сценариев продавца (UC-L1): вход по коду, фото-заглушки, загрузка через ячейки формы.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc32(bytes: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
}

/** PNG с цветными полосами: фикстура генерируется в тесте. */
export function stripedPng(seed: number, width = 320, height = 240): Buffer {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header.writeUInt8(8, 8); // глубина
    header.writeUInt8(2, 9); // RGB
    const rows: Buffer[] = [];
    for (let y = 0; y < height; y++) {
        const row = Buffer.alloc(1 + width * 3);
        for (let x = 0; x < width; x++) {
            const stripe = Math.floor(x / 20) + seed;
            row[1 + x * 3] = (stripe * 67) % 256;
            row[2 + x * 3] = (stripe * 131 + y) % 256;
            row[3 + x * 3] = (stripe * 29) % 256;
        }
        rows.push(row);
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(Buffer.concat(rows))),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

export async function xsrf(page: Page): Promise<string> {
    const cookie = (await page.context().cookies()).find((c) => c.name === 'XSRF-TOKEN');
    if (!cookie) throw new Error('Нет cookie XSRF-TOKEN');
    return decodeURIComponent(cookie.value);
}

/** Вход по коду (LOGIN_CODE_FAKE в e2e) и регистрация нового продавца. */
export async function signIn(page: Page): Promise<void> {
    await page.goto('/');
    const email = `seller-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
    const post = async (url: string, data: Record<string, unknown>) => {
        const response = await page.request.post(url, {
            data,
            headers: { 'X-XSRF-TOKEN': await xsrf(page), Accept: 'application/json' },
        });
        expect(response.ok(), `${url}: ${response.status()}`).toBeTruthy();
    };
    await post('/auth/email/code', { email });
    await post('/auth/email/verify', { email, code: '123456' });
    await post('/auth/register', { name: 'Иван', consent: true });
}

/** Загружает фото через ячейку «Добавить фото: …» и ждёт, пока оно появится в сетке. */
export async function addPhoto(page: Page, cell: string, seed: number): Promise<void> {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: `Добавить фото: ${cell}` }).click();
    await (
        await chooser
    ).setFiles({ name: `photo-${seed}.png`, mimeType: 'image/png', buffer: stripedPng(seed) });
}

/**
 * Переключает продавца на город без демо-объявлений (Воронеж): публикация в тестах не меняет число лотов
 * Москвы, Казани и Санкт-Петербурга, на которые рассчитаны UC-S2, UC-S3 и экран лота.
 */
export async function useQuietCity(page: Page): Promise<void> {
    const search = await page.request.get(`/cities?q=${encodeURIComponent('Воронеж')}`, {
        headers: { Accept: 'application/json' },
    });
    const cities = ((await search.json()) as { data: Array<{ id: number; name: string }> }).data;
    const city = cities.find((item) => item.name === 'Воронеж');
    if (!city) throw new Error('В справочнике нет города Воронеж');

    const response = await page.request.post('/city', {
        data: { city_id: city.id },
        headers: { 'X-XSRF-TOKEN': await xsrf(page), Accept: 'application/json' },
    });
    expect(response.ok(), `/city: ${response.status()}`).toBeTruthy();
}
