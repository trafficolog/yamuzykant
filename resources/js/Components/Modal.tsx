import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

export interface ModalProps {
    title: string;
    onClose: () => void;
    children: ReactNode;
}

/**
 * Окно поверх страницы на нативном `<dialog>`: фокус остаётся внутри, Esc закрывает (кнопка «Отмена» — в самом окне), страница под окном недоступна,
 * при закрытии фокус возвращается на кнопку, открывшую окно. Подложка и панель — токены ДС (`.ym-modal`).
 */
export default function Modal({ title, onClose, children }: ModalProps) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog || dialog.open) return;
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');

        return () => {
            if (typeof dialog.close === 'function' && dialog.open) dialog.close();
        };
    }, []);

    return (
        <dialog
            ref={ref}
            className="ym-modal"
            aria-labelledby={titleId}
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
        >
            <div className="ym-modal__panel">
                <h2 id={titleId} className="type-h3 ym-modal__title">
                    {title}
                </h2>
                {children}
            </div>
        </dialog>
    );
}
