import { Head } from '@inertiajs/react';

import { SHOWCASE } from '@/Components/DsShowcase/examples';
import { ru } from '@/lang/ru';

const groups = [...new Set(SHOWCASE.map((section) => section.group))];

/** Витрина /_ds: все компоненты `@ds` со всеми вариантами (только local и stage). */
export default function Showcase() {
    return (
        <div className="ym-root">
            <Head title={ru.ds.title} />
            <main
                style={{
                    maxWidth: 'var(--content-max)',
                    margin: '0 auto',
                    padding: 'var(--space-8) var(--space-6)',
                    display: 'grid',
                    gap: 'var(--space-12)',
                }}
            >
                <header style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    <h1 className="type-h1">{ru.ds.title}</h1>
                    <p className="type-body" style={{ color: 'var(--ink-muted)' }}>
                        {ru.ds.intro}
                    </p>
                    <nav aria-label={ru.ds.contents}>
                        <ul
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 'var(--space-2) var(--space-4)',
                                listStyle: 'none',
                                margin: 0,
                                padding: 0,
                            }}
                        >
                            {SHOWCASE.map((section) => (
                                <li key={section.component}>
                                    <a
                                        className="type-body-s"
                                        href={`#${section.component}`}
                                        style={{ color: 'var(--accent-text)' }}
                                    >
                                        {section.component}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </header>

                {groups.map((group) => (
                    <div key={group} style={{ display: 'grid', gap: 'var(--space-10)' }}>
                        <h2 className="type-h2">{group}</h2>
                        {SHOWCASE.filter((section) => section.group === group).map((section) => (
                            <section
                                key={section.component}
                                id={section.component}
                                data-ds-component={section.component}
                                style={{ display: 'grid', gap: 'var(--space-4)' }}
                            >
                                <h3 className="type-h3">{section.component}</h3>
                                {section.variants.map((variant) => (
                                    <div
                                        key={variant.label}
                                        data-ds-variant={variant.label}
                                        style={{ display: 'grid', gap: 'var(--space-2)' }}
                                    >
                                        <p
                                            className="type-caption"
                                            style={{ color: 'var(--ink-faint)' }}
                                        >
                                            {variant.label}
                                        </p>
                                        <div>{variant.node}</div>
                                    </div>
                                ))}
                            </section>
                        ))}
                    </div>
                ))}
            </main>
        </div>
    );
}
