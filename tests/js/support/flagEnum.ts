/**
 * Значения case-ов backed enum из исходника PHP. Устойчив к формату записи: кавычки любого вида,
 * пробелы и табуляции вокруг `=`, `;` или его отсутствие, закомментированные case-ы не берутся.
 */
export function parseFlagEnumCases(source: string): string[] {
    const withoutLineComments = source.replace(/\/\/[^\n]*/g, '');

    return [...withoutLineComments.matchAll(/^\s*case\s+\w+\s*=\s*(['"])([^'"]+)\1/gm)].map(
        (match): string => match[2] ?? '',
    );
}
