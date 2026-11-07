import { describe, expect, it } from 'vitest';

import { scrubEvent } from '@/observability/sentry';

describe('JS-скраббер: те же шаблоны, что в PHP', () => {
    it('маскирует Bearer, серийный номер и токены в тексте', () => {
        const event = {
            message:
                'Authorization: Bearer abc.def-123, Серийный номер: A12345678, S/N 99887766, {"access_token":"abc123SECRET"}, token="zzz999SECRET", password=qwerty12',
            extra: { note: 'api_key=KEY777SECRET' },
        };

        const dump = JSON.stringify(scrubEvent(event));

        for (const secret of [
            'abc.def-123',
            'A12345678',
            '99887766',
            'abc123SECRET',
            'zzz999SECRET',
            'qwerty12',
            'KEY777SECRET',
        ]) {
            expect(dump).not.toContain(secret);
        }
    });
});
