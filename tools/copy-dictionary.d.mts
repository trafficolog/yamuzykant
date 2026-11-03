// Типы для copy-dictionary.mjs (импорт из tests/e2e/copy.spec.ts под strict-режимом TypeScript).

export interface ForbiddenEntry {
    readonly word: string;
    readonly re: RegExp;
    readonly hint: string;
}

export interface ForbiddenHit {
    readonly word: string;
    readonly hint: string;
}

export interface RouteEntry {
    readonly method: string;
    readonly uri: string;
    readonly middleware?: readonly string[];
}

export const FORBIDDEN: readonly ForbiddenEntry[];

export function findForbidden(text: string): ForbiddenHit[];

export function pickRoutes(list: readonly RouteEntry[]): string[];
