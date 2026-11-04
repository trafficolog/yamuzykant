import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';

// UC-L1 п. 4 (BR-03): продавец загружает 3 фото — первое в ячейку «Серийный номер».
// Форма «Продать» — задача 2.1.3, поэтому загрузчик проверяется на служебной странице /_e2e/photo-uploader
// (только local, testing, e2e). Обработка идёт в очереди (queue:work в CI), фото показываются после неё.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc32(bytes: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
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
function stripedPng(seed: number, width = 320, height = 240): Buffer {
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

async function xsrf(page: Page): Promise<string> {
    const cookie = (await page.context().cookies()).find((c) => c.name === 'XSRF-TOKEN');
    if (!cookie) throw new Error('Нет cookie XSRF-TOKEN');
    return decodeURIComponent(cookie.value);
}

/** Вход по коду (LOGIN_CODE_FAKE в e2e) и регистрация нового продавца. */
async function signIn(page: Page): Promise<void> {
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

async function addPhoto(page: Page, cell: string, seed: number): Promise<void> {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: `Добавить фото: ${cell}` }).click();
    await (
        await chooser
    ).setFiles({ name: `photo-${seed}.png`, mimeType: 'image/png', buffer: stripedPng(seed) });
}

test.describe('UC-L1: фото объявления', () => {
    test('загрузка 3 фото: серийный номер и ещё два, фото готовы к показу', async ({ page }) => {
        await signIn(page);
        await page.goto('/_e2e/photo-uploader');

        const status = page.getByRole('status');
        await expect(status).toHaveText('Добавьте: ещё 3 фото, фото серийного номера.');
        await expect(page.getByText('обязательно')).toBeVisible();

        await addPhoto(page, 'Серийный номер', 1);
        await expect(page.getByRole('img', { name: 'Фото серийного номера' })).toBeVisible({
            timeout: 15_000,
        });

        await addPhoto(page, 'Общий вид', 2);
        await expect(page.getByRole('img', { name: 'Фото 2' })).toBeVisible({ timeout: 15_000 });
        await addPhoto(page, 'Корпус крупно', 3);
        await expect(page.getByRole('img', { name: 'Фото 3' })).toBeVisible({ timeout: 15_000 });

        await expect(status).toHaveText('');

        // Картинка отдаётся приложением в современном формате, исходник по URL недоступен.
        const src = await page
            .getByRole('img', { name: 'Фото 2' })
            .evaluate((img) => (img as HTMLImageElement).currentSrc);
        expect(src).toMatch(/\/media\/photos\/\d+\/square\.(avif|webp)/);
        const media = await page.request.get(src);
        expect(media.headers()['content-type']).toMatch(/^image\/(avif|webp)$/);

        // После перезагрузки фото на месте.
        await page.reload();
        await expect(page.getByRole('img', { name: 'Фото серийного номера' })).toBeVisible();
        await expect(page.getByRole('img', { name: 'Фото 3' })).toBeVisible();

        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        const serious = axe.violations.filter(
            (v) => v.impact === 'serious' || v.impact === 'critical',
        );
        expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual(
            [],
        );
    });

    test('PDF с расширением .jpg отклоняется сервером', async ({ page }) => {
        await signIn(page);
        await page.goto('/_e2e/photo-uploader');

        const chooser = page.waitForEvent('filechooser');
        await page.getByRole('button', { name: 'Добавить фото: Общий вид' }).click();
        await (
            await chooser
        ).setFiles({
            name: 'photo.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n'),
        });

        await expect(page.getByRole('alert')).toHaveText(
            'Это не фото. Загрузите файл в формате JPEG, PNG или HEIC.',
        );
    });
});
