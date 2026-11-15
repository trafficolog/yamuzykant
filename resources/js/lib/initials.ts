/** Буквы для аватара: первые буквы первых двух слов имени («Гитарный угол» → «ГУ»); без букв — «?». */
export function initials(name: string): string {
    const words = name.split(/\s+/).filter((word) => /^\p{L}/u.test(word));
    return (
        words
            .slice(0, 2)
            .map((word) => word.charAt(0))
            .join('')
            .toUpperCase() || '?'
    );
}
