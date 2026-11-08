import { Button, Icon } from '@ds';
import type { ReactNode } from 'react';

import PublicLayout from '@/Layouts/PublicLayout';
import { ru } from '@/lang/ru';

import '../../../css/sell.css';

interface SellPublishedProps {
    /** published — опубликовано сразу; pending — флаг premoderation, объявление на проверке. */
    status: 'published' | 'pending';
    listing: { id: string; title: string | null; url: string };
    /** Срок публикации в днях (config listings.expire_after_days). */
    days: number;
}

/**
 * Экран после «Опубликовать» (UC-L1 п. 7): «Объявление опубликовано» либо, при включённой премодерации,
 * «Отправлено на проверку». Макет — блок результата прототипа «Десктоп - Продать».
 */
export default function SellPublished({ status, listing, days }: SellPublishedProps) {
    const published = status === 'published';

    return (
        <div className="ym-sell">
            <nav aria-label={ru.sell.crumbs.label} className="ym-sell__crumbs">
                <a href="/" className="type-body-s ym-sell__crumb">
                    {ru.sell.crumbs.home}
                </a>
                <span aria-hidden="true" className="ym-sell__crumb-sep">
                    <Icon name="chevron-right" size={14} />
                </span>
                <span aria-current="page" className="type-body-s ym-sell__crumb-current">
                    {ru.sell.title}
                </span>
            </nav>

            <div className="ym-sell__head">
                <h1 className="type-h1 ym-sell__title">{ru.sell.title}</h1>
                <p className="type-body-s ym-sell__lead">{ru.sell.lead}</p>
            </div>

            <section className="ym-sell__done" aria-labelledby="sell-done-title">
                <span aria-hidden="true" className="ym-sell__done-icon">
                    <Icon name="circle-check" size={32} />
                </span>
                <h2 id="sell-done-title" className="type-h2 ym-sell__done-title">
                    {published
                        ? ru.sell.published.heading.published
                        : ru.sell.published.heading.pending}
                </h2>
                <p className="type-body ym-sell__done-text">
                    {published
                        ? ru.sell.published.published(listing.title ?? '', days)
                        : ru.sell.published.pending}
                </p>
                <div className="ym-sell__done-actions">
                    <Button variant="primary" href={listing.url}>
                        {ru.sell.published.open}
                    </Button>
                    <Button variant="outline" href="/sell">
                        {ru.sell.published.again}
                    </Button>
                </div>
            </section>
        </div>
    );
}

SellPublished.layout = (page: ReactNode) => <PublicLayout tab="sell">{page}</PublicLayout>;
