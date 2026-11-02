// Проба CI 0.1.3: ESLint (no-explicit-any) и tsc (несовпадение типов) должны упасть.
export const probe: any = 1;
export const count: number = 'не число';
