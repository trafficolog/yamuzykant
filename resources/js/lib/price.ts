/** Предел цены в рублях: серверное правило StoreListingRequest::PRICE_MAX. */
export const PRICE_MAX = 99_999_999;

const NBSP = ' ';
const MAX_DIGITS = String(PRICE_MAX).length;

/**
 * Цена для поля ввода: «184 500» (неразрывный пробел между тысячами, AGENTS §5). Всё, кроме цифр,
 * игнорируется; ведущие нули убираются; лишние цифры сверх предела отбрасываются. Пусто — пустая строка.
 */
export function formatPrice(input: string): string {
    const digits = input.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITS);

    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Целые рубли из текста поля; без цифр — 0. */
export function parsePrice(text: string): number {
    const digits = text.replace(/\D/g, '');

    return digits === '' ? 0 : Number(digits);
}
