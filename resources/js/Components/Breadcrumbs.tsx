import { Icon } from '@ds';
import { Link } from '@inertiajs/react';
import { Fragment } from 'react';

import { ru } from '@/lang/ru';

export interface Crumb {
    label: string;
    /** Без адреса — текущая страница (последний элемент). */
    href?: string;
}

export interface BreadcrumbsProps {
    items: readonly Crumb[];
}

/** Хлебные крошки: ссылки через шеврон, текущая страница — `aria-current="page"` без ссылки. */
export default function Breadcrumbs({ items }: BreadcrumbsProps) {
    return (
        <nav aria-label={ru.breadcrumbs.label} className="ym-crumbs">
            {items.map((item, index) => (
                <Fragment key={`${index}-${item.label}`}>
                    {index > 0 ? (
                        <span aria-hidden="true" className="ym-crumbs__sep">
                            <Icon name="chevron-right" size={14} />
                        </span>
                    ) : null}
                    {item.href !== undefined ? (
                        <Link href={item.href} className="ym-crumbs__link body-s">
                            {item.label}
                        </Link>
                    ) : (
                        <span aria-current="page" className="ym-crumbs__current body-s">
                            {item.label}
                        </span>
                    )}
                </Fragment>
            ))}
        </nav>
    );
}
