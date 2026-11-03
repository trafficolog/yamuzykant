// Закрепление сторонних actions и защита токена в workflows (0.1.8).
// Без закрепления SHA тег `@v4` может переехать на чужой коммит (supply chain), поэтому:
//   - каждый `uses:` (кроме локальных `./…`) — 40-символьный SHA коммита и комментарий с версией;
//   - каждый actions/checkout — `persist-credentials: false`: токен не остаётся в .git/config.
//     Jobs, которым нужен push с токеном, в workflows нет: gh release create работает через GH_TOKEN,
//     а не через сохранённые credentials checkout.
// Запуск: node --test .github/scripts/workflow-pins.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from './workflow-yaml.mjs';

const WORKFLOWS = join(dirname(fileURLToPath(import.meta.url)), '..', 'workflows');
const files = readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));

const SHA_USES = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/;
const USES_LINE = /^\s*(?:-\s+)?uses:\s*(\S+)(?:\s+#\s*(\S.*))?$/;

// Нарушения закрепления в тексте workflow: «файл:строка — что не так».
export const pinViolations = (yamlText, name = 'workflow.yml') => {
    const out = [];
    yamlText.split('\n').forEach((line, i) => {
        const m = line.match(USES_LINE);
        if (!m) return;
        const [, ref, version] = m;
        const at = `${name}:${i + 1}`;
        if (ref.startsWith('./')) return;
        if (!SHA_USES.test(ref)) out.push(`${at} — ${ref} не закреплён 40-символьным SHA`);
        else if (!version) out.push(`${at} — ${ref} без комментария с версией (# v1.2.3)`);
    });
    return out;
};

// Шаги actions/checkout без `persist-credentials: false`.
export const credentialViolations = (workflow, name = 'workflow.yml') => {
    const out = [];
    for (const [job, def] of Object.entries(workflow.jobs ?? {})) {
        (def.steps ?? []).forEach((step, i) => {
            if (!/^actions\/checkout@/.test(String(step.uses ?? ''))) return;
            if (String(step.with?.['persist-credentials']) !== 'false')
                out.push(`${name}: job ${job}, шаг ${i + 1} — у checkout нет persist-credentials: false`);
        });
    }
    return out;
};

const SHA = 'a'.repeat(40);

test('проверка закрепления ловит тег, ветку, короткий SHA и отсутствие версии', () => {
    const bad = [
        '      - uses: actions/checkout@v4',
        '      - uses: actions/cache@main # main',
        `      - uses: actions/setup-node@${'a'.repeat(7)} # v4`,
        `      - uses: shivammathur/setup-php@${SHA}`,
        `      - uses: actions/upload-artifact@${'A'.repeat(40)} # v4`,
        '      - uses: webfactory/ssh-agent',
    ].join('\n');
    assert.equal(pinViolations(bad).length, 6);
});

test('проверка закрепления пропускает SHA с версией и локальные actions', () => {
    const good = [
        `      - uses: actions/checkout@${SHA} # v4.4.0`,
        `      - id: x`,
        `        uses: actions/cache@${SHA} # v4.3.0`,
        '      - uses: ./.github/actions/local',
        '      - run: echo "uses: actions/checkout@v4"',
    ].join('\n');
    assert.deepEqual(pinViolations(good), []);
});

test('проверка checkout ловит отсутствие и значение true', () => {
    const wf = parseYaml(
        [
            'jobs:',
            '  a:',
            '    steps:',
            `      - uses: actions/checkout@${SHA} # v4`,
            `      - uses: actions/checkout@${SHA} # v4`,
            '        with:',
            '          persist-credentials: true',
            `      - uses: actions/checkout@${SHA} # v4`,
            '        with:',
            '          persist-credentials: false',
            `      - uses: actions/setup-node@${SHA} # v4`,
        ].join('\n'),
    );
    assert.equal(credentialViolations(wf).length, 2);
});

for (const file of files) {
    const source = readFileSync(join(WORKFLOWS, file), 'utf8');

    test(`${file}: все uses закреплены 40-символьным SHA с комментарием версии`, () => {
        assert.match(source, /\buses:/, 'в workflow нет ни одного uses — проверка бессмысленна');
        assert.deepEqual(pinViolations(source, file), []);
    });

    test(`${file}: у actions/checkout persist-credentials: false`, () => {
        assert.deepEqual(credentialViolations(parseYaml(source), file), []);
    });
}

test('ci.yml: сверка resources/js/ds не пропускается, когда каталога нет', () => {
    const ci = parseYaml(readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8'));
    const step = ci.jobs.docs.steps.find((s) => /ds-sync\.mjs/.test(String(s.run ?? '')));
    assert.ok(step, 'нет шага сверки resources/js/ds с ds:sync');
    assert.doesNotMatch(step.run, /-d\s+resources\/js\/ds/, 'шаг проверяет наличие каталога и пропускается');
    assert.doesNotMatch(step.run, /пропущен/);
    assert.doesNotMatch(step.run, /exit 0/);
    assert.match(step.run, /git status --porcelain[^\n]*resources\/js\/ds/);
});

test('job docs запускает проверку закрепления actions', () => {
    const ci = parseYaml(readFileSync(join(WORKFLOWS, 'ci.yml'), 'utf8'));
    const runs = ci.jobs.docs.steps.map((s) => String(s.run ?? '')).join('\n');
    assert.match(runs, /workflow-pins\.test\.mjs/);
});
