/**
 * Скелетон карточки выдачи: те же `ym-card`, квадрат фото и блок текста, что у ListingCard ДС, поэтому
 * сетка при загрузке не сдвигается. Полоски — `ym-skel` ДС (в ДС нет готового компонента скелетона).
 */
export default function FleaListingSkeleton() {
    return (
        <div className="ym-card ym-flea__skeleton" aria-hidden="true">
            <div className="ym-card__media ym-skel" />
            <div className="ym-card__body">
                <span className="ym-skel ym-skel--w60 ym-flea__skeleton-price" />
                <span className="ym-skel ym-flea__skeleton-title" />
                <span className="ym-skel ym-skel--w40" />
            </div>
        </div>
    );
}
