#!/usr/bin/env node
// Ручное подтверждение выкатки production вместо правил окружения (бесплатный тариф, задача 0.1.10).
// Разрешает выкатку, если и запустивший (github.actor), и перезапустивший (github.triggering_actor)
// есть в .github/production-deployers.txt, а тег — релиз vX.Y.Z с X ≥ 1 (v0.* — только GitHub Release).
//
//   node .github/scripts/workflow-guards.mjs authorize --actor A --triggering-actor B --tag v1.0.0 [--allowlist PATH]
//
// Выход 0 — разрешено, 1 — отказ (причина в stderr), 2 — ошибка вызова.
import console from 'node:console';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEFAULT_ALLOWLIST = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'production-deployers.txt',
);
const RELEASE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function readAllowlist(path) {
    return readFileSync(path, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.replace(/#.*/, '').trim())
        .filter(Boolean)
        .map((login) => login.toLowerCase());
}

/** Возвращает null, если выкатка разрешена, иначе причину отказа. */
export function denyReason({ actor, triggeringActor, tag, allowlist }) {
    const match = RELEASE_TAG.exec(tag ?? '');
    if (!match) return `тег «${tag}» не похож на релиз vX.Y.Z`;
    if (match[1] === '0')
        return `тег ${tag}: версии v0.* в production не выкатываются — только GitHub Release`;
    if (allowlist.length === 0) return 'список выкатки production пуст';
    for (const [role, login] of [
        ['github.actor', actor],
        ['github.triggering_actor', triggeringActor],
    ]) {
        if (!login || !allowlist.includes(login.toLowerCase())) {
            return `${role} «${login ?? ''}» нет в списке выкатки production`;
        }
    }
    return null;
}

function parseArgs(argv) {
    const opts = {};
    for (let i = 0; i < argv.length; i += 2) {
        const key = argv[i];
        if (!key.startsWith('--') || i + 1 >= argv.length)
            throw new Error(`неверный аргумент ${key}`);
        opts[key.slice(2)] = argv[i + 1];
    }
    return opts;
}

function main(argv) {
    const [command, ...rest] = argv;
    if (command !== 'authorize') {
        console.error(
            'использование: workflow-guards.mjs authorize --actor A --triggering-actor B --tag vX.Y.Z',
        );
        return 2;
    }
    let opts;
    try {
        opts = parseArgs(rest);
    } catch (e) {
        console.error(e.message);
        return 2;
    }
    const allowlist = readAllowlist(opts.allowlist ?? DEFAULT_ALLOWLIST);
    const reason = denyReason({
        actor: opts.actor,
        triggeringActor: opts['triggering-actor'],
        tag: opts.tag,
        allowlist,
    });
    if (reason) {
        console.error(`::error::Выкатка production запрещена: ${reason}`);
        return 1;
    }
    console.log(`Выкатка ${opts.tag} в production: разрешено, ${opts.actor} есть в списке`);
    return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    process.exitCode = main(process.argv.slice(2));
}
