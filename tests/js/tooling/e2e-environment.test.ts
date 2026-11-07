import { describe, expect, it } from 'vitest';

import { assertDisposableEnvironment } from '../../e2e/_environment';

describe('e2e: удаление тестового пользователя только в одноразовом окружении', () => {
    it.each(['e2e', 'testing', ' e2e\n'])('«%s» разрешено', (environment) => {
        expect(() => assertDisposableEnvironment(environment)).not.toThrow();
    });

    it.each(['local', 'production', 'stage', 'staging', 'E2E', '', undefined, null])(
        '«%s» — отказ',
        (environment) => {
            expect(() => assertDisposableEnvironment(environment)).toThrow(
                /APP_ENV=e2e или testing/,
            );
        },
    );
});
