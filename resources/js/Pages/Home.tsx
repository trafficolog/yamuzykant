import type { ReactNode } from 'react';

import PublicLayout from '@/Layouts/PublicLayout';
import { ru } from '@/lang/ru';

export default function Home() {
    return <h1>{ru.brand}</h1>;
}

Home.layout = (page: ReactNode) => <PublicLayout tab="home">{page}</PublicLayout>;
