import { type RefObject, useCallback, useEffect, useState } from 'react';

/**
 * Раскрывающееся меню без модальности: Esc закрывает и возвращает фокус на кнопку `toggleId`,
 * клик и фокус вне `rootRef` закрывают без возврата фокуса.
 */
export function useDisclosure(rootRef: RefObject<HTMLElement>, toggleId: string) {
    const [open, setOpen] = useState(false);

    const close = useCallback(
        (restoreFocus: boolean) => {
            setOpen(false);
            if (restoreFocus) document.getElementById(toggleId)?.focus();
        },
        [toggleId],
    );

    useEffect(() => {
        if (!open) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') close(true);
        };
        const outside = (event: Event) => {
            const target = event.target;
            if (target instanceof Node && !rootRef.current?.contains(target)) close(false);
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('pointerdown', outside);
        document.addEventListener('focusin', outside);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('focusin', outside);
        };
    }, [open, close, rootRef]);

    return { open, toggle: () => setOpen((value) => !value), close };
}
