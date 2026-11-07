import { Link } from '@inertiajs/react';

import { ru } from '@/lang/ru';

export interface PaginationProps {
    page: number;
    pages: number;
    /** Адрес страницы: номера — настоящие ссылки, их читает поисковик. */
    href: (page: number) => string;
}

type Item = number | 'gap-start' | 'gap-end';

/** Первая, последняя и соседи текущей; пропуск — многоточие. */
function items(page: number, pages: number): Item[] {
    const shown = new Set([1, pages, page - 1, page, page + 1]);
    const result: Item[] = [];
    let previous = 0;
    for (const n of [...shown].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)) {
        if (n - previous > 1) result.push(previous === 1 ? 'gap-start' : 'gap-end');
        result.push(n);
        previous = n;
    }
    return result;
}

/** Номера страниц выдачи; на единственной странице ничего не рисует. */
export default function Pagination({ page, pages, href }: PaginationProps) {
    if (pages <= 1) return null;

    return (
        <nav aria-label={ru.pagination.label} className="ym-pagination">
            {page > 1 ? (
                <Link href={href(page - 1)} rel="prev" className="ym-pagination__item">
                    {ru.pagination.prev}
                </Link>
            ) : null}
            {items(page, pages).map((item) => {
                if (typeof item !== 'number') {
                    return (
                        <span key={item} className="ym-pagination__gap" aria-hidden="true">
                            …
                        </span>
                    );
                }
                return item === page ? (
                    <span key={item} aria-current="page" className="ym-pagination__item is-current">
                        {item}
                    </span>
                ) : (
                    <Link
                        key={item}
                        href={href(item)}
                        aria-label={ru.pagination.page(item)}
                        className="ym-pagination__item"
                    >
                        {item}
                    </Link>
                );
            })}
            {page < pages ? (
                <Link href={href(page + 1)} rel="next" className="ym-pagination__item">
                    {ru.pagination.next}
                </Link>
            ) : null}
        </nav>
    );
}
