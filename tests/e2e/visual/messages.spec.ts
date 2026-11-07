import { test, type Browser, type Page } from '@playwright/test';
import { hydrated, post, sellerListingId, signedInPage, startConversation } from '../_messaging';
import { expectMatchesReference } from './_helpers';

// Экран «messages» (гейт G1, задача 4.1.2): список чатов и переписка против design/screens/messages@{1440,390}.png.
//
// Прототип нарисован с чатами вне MVP (новости и поддержка ЯМузыканта, мастер, магазин-партнёр), со статусом
// «в сети», кнопками «Предложить цену» (G2) и «Прикрепить фото», быстрыми ответами мастера и поддержки и
// шапкой и подвалом со всеми флагами. В R1 этого нет, поэтому вид сверяется с эталоном состояния
// messages--r1@{1440,390}.png, снятым с реализации в CI (Linux, как flea--r1) и принятым OWNER на G1;
// отличия — в design/DEVIATIONS.md. Динамика (даты, время, счётчики) закрыта маской [data-dynamic].
//
// Данные: покупатель «Анна» и три продавца с одним объявлением каждый; беседа с «Андрей К.» открыта на 1440,
// на 390 — список чатов, как на эталоне.

async function seeded(browser: Browser, viewport: { width: number; height: number }) {
    const buyer = await signedInPage(browser, 'Анна', viewport);
    const conversations: string[] = [];
    for (const [seller, ask, answer] of [
        [
            'Андрей К.',
            'Добрый вечер.\n1. Гриф шлифовали один раз — у какого мастера?\n2. Звукосниматели родные?\n3. Где в Москве можно посмотреть и попробовать?',
            'Здравствуйте. Шлифовали в «Лад и строй», чек есть. Звукосниматели родные. Можно посмотреть у Таганской в выходные.',
        ],
        ['Ирина С.', 'Гитара ещё продаётся?', 'Нет, вчера продала. Извините.'],
        [
            'Олег М.',
            'Можно забрать сегодня после 19:00?',
            'Да, до 21:00. Отложил на ваше имя до завтра.',
        ],
    ] as const) {
        const page: Page = await signedInPage(browser, seller);
        const listingId = await sellerListingId(page);
        const id = await startConversation(buyer, listingId, ask);
        const reply = await post(page, `/conversations/${id}/messages`, { body: answer });
        if (!reply.ok()) throw new Error(`Ответ продавца: ${reply.status()}`);
        conversations.push(id);
        await page.context().close();
    }
    return { buyer, first: conversations[0] as string };
}

test.describe('@visual messages', () => {
    test('messages@1440, R1: список и открытая переписка', async ({ browser }) => {
        const { buyer, first } = await seeded(browser, { width: 1440, height: 900 });
        await hydrated(buyer, `/messages/${first}`);
        await buyer.getByRole('log').waitFor();
        await expectMatchesReference(buyer, 'messages', '1440', { state: 'r1' });
    });

    test('messages@390, R1: список чатов', async ({ browser }) => {
        const { buyer } = await seeded(browser, { width: 390, height: 844 });
        await hydrated(buyer, '/messages');
        await expectMatchesReference(buyer, 'messages', '390', { state: 'r1' });
    });
});
