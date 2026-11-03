import { Head } from '@inertiajs/react';
import type { ReactNode } from 'react';

import SiteFooter from '@/Components/SiteFooter';
import SiteHeader, { type SiteHeaderProps } from '@/Components/SiteHeader';
import { ru } from '@/lang/ru';

export const MAIN_ID = 'main-content';

export interface PublicLayoutProps extends Pick<
    SiteHeaderProps,
    'active' | 'search' | 'city' | 'messages' | 'categories' | 'onSearch'
> {
    /** Заголовок вкладки; без него остаётся «ЯМузыкант». */
    title?: string;
    children?: ReactNode;
}

/**
 * Каркас публичных страниц: ссылка «Перейти к содержимому», шапка, `<main>`, подвал.
 * Страницы подключают его постоянной раскладкой: `Page.layout = (page) => <PublicLayout>{page}</PublicLayout>`.
 */
export default function PublicLayout({ title, children, ...header }: PublicLayoutProps) {
    return (
        <div className="ym-root ym-site">
            <Head title={title} />
            <a className="ym-site__skip" href={`#${MAIN_ID}`}>
                {ru.layout.skipLink}
            </a>
            <SiteHeader {...header} />
            <main id={MAIN_ID} tabIndex={-1} className="ym-site__main">
                {children}
            </main>
            <SiteFooter />
        </div>
    );
}
