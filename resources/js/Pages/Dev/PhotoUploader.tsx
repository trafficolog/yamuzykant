import { Head } from '@inertiajs/react';

import PhotoUploader from '@/Components/PhotoUploader';
import type { ListingPhoto } from '@/Components/photoUploaderApi';
import { ru } from '@/lang/ru';

interface Props {
    listingId: string;
    photos: ListingPhoto[];
}

/** Служебная страница загрузчика фото для e2e до формы «Продать» (2.1.3). Только local, testing, e2e. */
export default function PhotoUploaderPlayground({ listingId, photos }: Props) {
    return (
        <div className="ym-root">
            <Head title={ru.photos.title} />
            <main
                style={{
                    maxWidth: 'var(--content-max)',
                    margin: '0 auto',
                    padding: 'var(--space-8) var(--space-6)',
                    display: 'grid',
                    gap: 'var(--space-5)',
                }}
            >
                <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                    <h1 className="type-h3">{ru.photos.title}</h1>
                    <p className="type-body-s" style={{ margin: 0, color: 'var(--ink-muted)' }}>
                        {ru.photos.hint}
                    </p>
                </div>
                <PhotoUploader listingId={listingId} initialPhotos={photos} />
            </main>
        </div>
    );
}
