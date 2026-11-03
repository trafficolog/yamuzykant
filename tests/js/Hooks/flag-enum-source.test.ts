import { describe, expect, it } from 'vitest';

import { parseFlagEnumCases } from '../support/flagEnum';

// Ревью 0.1.9: разбор case-ов enum FeatureFlag устойчив к формату записи (кавычки, пробелы, `;`).

describe('parseFlagEnumCases', () => {
    it('принимает двойные и одинарные кавычки, пробелы и перенос', () => {
        const source = [
            'enum FeatureFlag: string',
            '{',
            '    case CatalogNew = "catalog_new";',
            "    case\tMasters  =  'masters'  ;",
            "    case SafeDeal='safe_deal'",
            '}',
        ].join('\n');

        expect(parseFlagEnumCases(source)).toEqual(['catalog_new', 'masters', 'safe_deal']);
    });

    it('не берёт case из комментариев и строковых литералов', () => {
        const source = [
            'enum FeatureFlag: string',
            '{',
            "    // case Old = 'old_flag';",
            "    case Wallet = 'wallet';",
            '}',
        ].join('\n');

        expect(parseFlagEnumCases(source)).toEqual(['wallet']);
    });
});
