import { router } from '@inertiajs/react';
import type { ReactNode } from 'react';

import EmptyState from '@/Components/EmptyState';
import FleaListingCard from '@/Components/FleaListingCard';
import Pagination from '@/Components/Pagination';
import UnavailableFavoriteCard from '@/Components/UnavailableFavoriteCard';
import AccountLayout from '@/Layouts/AccountLayout';
import { ru } from '@/lang/ru';
import { FAVORITES_PATH, fleaPath, lotPath } from '@/lib/paths';

type Condition = 'new' | 'mint' | 'excellent' | 'very-good' | 'good' | 'fair' | 'poor' | 'parts';

/**
 * Карточка вкладки (FavoriteCardResource). Опубликованное — поля карточки и `old_price`, если цена с момента
 * добавления снизилась; не опубликованное — только id, название и цена (SPEC §6.1).
 */
export type FavoriteItem =
    | {
          available: true;
          id: string;
          title: string;
          price: number | null;
          old_price: number | null;
          condition: string | null;
          city: string | null;
          ship: boolean;
          negotiable: boolean;
          posted: string | null;
          image: string | null;
          favorite: true;
      }
    | { available: false; id: string; title: string; price: number | null; favorite: true };

interface Props {
    favorites: FavoriteItem[];
    pagination: { page: number; pages: number };
}

const favoritesHref = (page: number): string =>
    page > 1 ? `${FAVORITES_PATH}?page=${page}` : FAVORITES_PATH;

/**
 * «Избранное» кабинета (UC-S5, 4.3.1): карточки Барахолки с включённым сердцем, снижение цены — значок скидки
 * и прежняя цена; снятое с продажи — плитка с плашкой «Снято с продажи» без ссылки.
 */
export default function AccountFavorites({ favorites, pagination }: Props) {
    if (favorites.length === 0) {
        return (
            <EmptyState
                icon="heart"
                action={{ label: ru.favorites.toFlea, onClick: () => router.visit(fleaPath()) }}
            >
                {ru.favorites.empty}
            </EmptyState>
        );
    }

    return (
        <div className="ym-account-favorites">
            <ul aria-label={ru.account.favorites} className="ym-account-favorites__grid">
                {favorites.map((item) => (
                    <li key={item.id}>
                        {item.available ? (
                            <FleaListingCard
                                listingId={item.id}
                                favorite={item.favorite}
                                title={item.title}
                                href={lotPath(item.id)}
                                price={item.price}
                                oldPrice={item.old_price ?? undefined}
                                condition={(item.condition ?? undefined) as Condition | undefined}
                                city={item.city ?? undefined}
                                posted={item.posted ?? undefined}
                                delivery={item.ship ? ru.flea.shipping : undefined}
                                image={item.image ?? undefined}
                                safe={false}
                            />
                        ) : (
                            <UnavailableFavoriteCard
                                listingId={item.id}
                                title={item.title}
                                price={item.price}
                            />
                        )}
                    </li>
                ))}
            </ul>
            <Pagination page={pagination.page} pages={pagination.pages} href={favoritesHref} />
        </div>
    );
}

AccountFavorites.layout = (page: ReactNode) => (
    <AccountLayout active="favorites">{page}</AccountLayout>
);
