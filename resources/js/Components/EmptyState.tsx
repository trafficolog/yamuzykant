import { Button, Icon, type IconName } from '@ds';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
    icon: IconName;
    action?: { label: string; onClick: () => void };
    children: ReactNode;
}

/** Пустое состояние по ДС: иконка 40 px в круге surface-recessed, одно предложение, кнопка outline по желанию. */
export default function EmptyState({ icon, action, children }: EmptyStateProps) {
    return (
        <div className="ym-empty">
            <span className="ym-empty__icon" aria-hidden="true">
                <Icon name={icon} size={40} />
            </span>
            <p className="ym-empty__text body">{children}</p>
            {action ? (
                <Button variant="outline" size="s" onClick={action.onClick}>
                    {action.label}
                </Button>
            ) : null}
        </div>
    );
}
