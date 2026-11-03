// Защита release.yml и deploy.yml без branch protection (задача 0.1.10, аудит G0: R1, R2).
// Проверяет условия `if` и `permissions` workflow, вычисляя их в контекстах событий GitHub,
// и команду authorize, которая пускает к выкатке production только OWNER из списка.
// Запуск: node --test .github/scripts/workflow-guards.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { evaluate, jobRuns, parseYaml } from './workflow-yaml.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GITHUB_DIR = join(HERE, '..');
const WORKFLOWS = join(GITHUB_DIR, 'workflows');
const GUARDS = join(HERE, 'workflow-guards.mjs');
const ALLOWLIST = join(GITHUB_DIR, 'production-deployers.txt');
const REPO = 'trafficolog/yamuzykant';
const OWNER = 'trafficolog';

const load = (name) => parseYaml(readFileSync(join(WORKFLOWS, name), 'utf8'));
const workflowFiles = readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));

// Job запускается, если истинно его `if` и запускаются все jobs из needs.
const runs = (wf, name, ctx, seen = new Set()) => {
    const job = wf.jobs[name];
    assert.ok(job, `нет job ${name}`);
    if (seen.has(name)) throw new Error(`цикл needs: ${name}`);
    const needs = [].concat(job.needs ?? []);
    return jobRuns(job, ctx) && needs.every((n) => runs(wf, n, ctx, new Set([...seen, name])));
};
const needsClosure = (wf, name) => {
    const out = new Set();
    const walk = (n) => [].concat(wf.jobs[n].needs ?? []).forEach((d) => (out.add(d), walk(d)));
    walk(name);
    return out;
};
const text = (value) => JSON.stringify(value);
// Job выкатки — тот, кому доступны секреты: есть environment или ссылка на secrets.
const deployJobs = (wf) =>
    Object.keys(wf.jobs).filter(
        (n) => wf.jobs[n].environment || /secrets\./.test(text(wf.jobs[n])),
    );
const releaseJobs = (wf) =>
    Object.keys(wf.jobs).filter((n) => /gh release create/.test(text(wf.jobs[n].steps)));

// ---------- контексты событий ----------

const workflowRun = (over = {}) => ({
    github: {
        event_name: 'workflow_run',
        repository: REPO,
        ref: 'refs/heads/main',
        actor: OWNER,
        triggering_actor: OWNER,
        event: {
            workflow_run: {
                conclusion: 'success',
                event: 'push',
                head_branch: 'main',
                head_sha: 'abc123',
                head_repository: { full_name: REPO },
                ...over,
            },
        },
    },
});

const tagPush = (tag, actor = OWNER) => ({
    github: {
        event_name: 'push',
        repository: REPO,
        ref: `refs/tags/${tag}`,
        ref_name: tag,
        ref_type: 'tag',
        actor,
        triggering_actor: actor,
        event: { ref: `refs/tags/${tag}` },
    },
    inputs: {},
});

const dispatch = (tag, { ref = 'refs/heads/main', actor = OWNER } = {}) => ({
    github: {
        event_name: 'workflow_dispatch',
        repository: REPO,
        ref,
        ref_name: ref.replace(/^refs\/(heads|tags)\//, ''),
        ref_type: 'branch',
        actor,
        triggering_actor: actor,
        event: { inputs: { tag } },
    },
    inputs: { tag },
});

// ---------- разбор YAML и выражений (инструмент самих проверок) ----------

test('workflow-yaml: блочные строки, однострочные словари, комментарии', () => {
    const doc = parseYaml(
        [
            'a: 1 # комментарий',
            'b: { contents: write }',
            "c: ['5432:5432', x]",
            'd: |',
            '  echo "#не комментарий"',
            '  exit 0',
            'e: >-',
            '  one',
            '  two',
            'f:',
            '  - uses: x@v1',
            '    with:',
            "      k: '${{ y }}'",
            '  - run: z',
        ].join('\n'),
    );
    assert.deepEqual(doc, {
        a: 1,
        b: { contents: 'write' },
        c: ['5432:5432', 'x'],
        d: 'echo "#не комментарий"\nexit 0\n',
        e: 'one two',
        f: [{ uses: 'x@v1', with: { k: '${{ y }}' } }, { run: 'z' }],
    });
});

test('workflow-yaml: выражения по правилам GitHub', () => {
    const ctx = {
        github: { actor: 'Trafficolog', event: { inputs: { tag: 'v1.0.0' } } },
        inputs: {},
    };
    assert.equal(
        evaluate("${{ github.actor == 'trafficolog' }}", ctx),
        true,
        'строки сравниваются без регистра',
    );
    assert.equal(
        evaluate("startsWith(github.event.inputs.tag, 'v1.') && !contains('a,b', 'c')", ctx),
        true,
    );
    assert.equal(
        evaluate("github.missing.deep == ''", ctx),
        true,
        'нет свойства — null, равен пустой строке',
    );
    assert.equal(evaluate("(false || github.actor != 'x') && success()", ctx), true);
    assert.equal(jobRuns({}, ctx), true, 'без if — success()');
    assert.throws(() => evaluate('github.actor ==', ctx));
});

// ---------- permissions ----------

test('у каждого workflow есть явный блок permissions без прав на запись', () => {
    assert.ok(workflowFiles.length >= 3, 'ожидались ci.yml, deploy.yml, release.yml');
    for (const file of workflowFiles) {
        const wf = load(file);
        assert.ok(Object.hasOwn(wf, 'permissions'), `${file}: нет верхнего permissions`);
        assert.doesNotMatch(text(wf.permissions), /write/, `${file}: запись на уровне workflow`);
    }
});

test('запись — только contents: write у job, создающего GitHub Release', () => {
    for (const file of workflowFiles) {
        const wf = load(file);
        for (const [name, job] of Object.entries(wf.jobs)) {
            if (!/write/.test(text(job.permissions ?? {}))) continue;
            assert.equal(file, 'release.yml', `${file}/${name}: права на запись вне release.yml`);
            assert.ok(
                releaseJobs(wf).includes(name),
                `${file}/${name}: запись у job, который не создаёт Release`,
            );
            assert.deepEqual(
                job.permissions,
                { contents: 'write' },
                `${file}/${name}: лишние права`,
            );
        }
    }
});

test('jobs выкатки не получают прав на запись', () => {
    for (const file of ['deploy.yml', 'release.yml']) {
        const wf = load(file);
        for (const name of deployJobs(wf)) {
            assert.doesNotMatch(text(wf.jobs[name].permissions ?? {}), /write/, `${file}/${name}`);
        }
    }
});

test('пользовательский ввод не подставляется в run (защита от внедрения команд)', () => {
    for (const file of workflowFiles) {
        const wf = load(file);
        for (const [name, job] of Object.entries(wf.jobs)) {
            for (const step of job.steps ?? []) {
                assert.doesNotMatch(
                    String(step.run ?? ''),
                    /\$\{\{\s*(inputs\.|github\.event\.inputs|github\.head_ref|github\.event\.workflow_run\.head_branch)/,
                    `${file}/${name}: ${step.name ?? step.run}`,
                );
            }
        }
    }
});

// ---------- deploy.yml (R2) ----------

test('deploy.yml: запускается только от завершения CI', () => {
    const wf = load('deploy.yml');
    assert.deepEqual(Object.keys(wf.on), ['workflow_run']);
    assert.deepEqual(wf.on.workflow_run.workflows, ['CI']);
    assert.ok(deployJobs(wf).length > 0, 'в deploy.yml нет job выкатки');
});

test('deploy.yml: зелёный CI от push в main этого репозитория — выкатка stage идёт', () => {
    const wf = load('deploy.yml');
    for (const name of deployJobs(wf)) assert.equal(runs(wf, name, workflowRun()), true, name);
});

const deploySkipped = {
    'PR из форка с веткой main': {
        event: 'pull_request',
        head_repository: { full_name: 'attacker/yamuzykant' },
    },
    'push в main форка': { head_repository: { full_name: 'attacker/yamuzykant' } },
    'PR из ветки этого репозитория с именем main': { event: 'pull_request' },
    'push в другую ветку': { head_branch: 'task/x' },
    'имя форка содержит имя репозитория': {
        head_repository: { full_name: 'attacker/trafficolog-yamuzykant' },
    },
    'ручной запуск CI': { event: 'workflow_dispatch' },
    'красный CI': { conclusion: 'failure' },
    'отменённый CI': { conclusion: 'cancelled' },
    'нет head_repository': { head_repository: null },
};
for (const [label, over] of Object.entries(deploySkipped)) {
    test(`deploy.yml: ${label} — выкатка пропущена`, () => {
        const wf = load('deploy.yml');
        for (const name of deployJobs(wf))
            assert.equal(runs(wf, name, workflowRun(over)), false, name);
    });
}

// ---------- release.yml (R1) ----------

test('release.yml: триггеры — тег v* и ручной запуск с параметром tag', () => {
    const wf = load('release.yml');
    assert.deepEqual(wf.on.push?.tags, ['v*']);
    assert.ok(!wf.on.push?.branches, 'push веток не должен запускать release.yml');
    assert.equal(
        wf.on.workflow_dispatch?.inputs?.tag?.required,
        true,
        'нужен обязательный input tag',
    );
    assert.ok(deployJobs(wf).length > 0, 'нет job выкатки production');
    assert.equal(releaseJobs(wf).length, 1, 'ровно один job создаёт GitHub Release');
});

for (const tag of ['v0.1.0', 'v0.2.0', 'v0.0.0-probe.1', 'v1.0.0', 'v2.3.4']) {
    test(`release.yml: тег ${tag} создаёт GitHub Release и не запускает выкатку`, () => {
        const wf = load('release.yml');
        const ctx = tagPush(tag);
        for (const name of deployJobs(wf))
            assert.equal(runs(wf, name, ctx), false, `${name} запустился бы от тега`);
        const [release] = releaseJobs(wf);
        assert.equal(runs(wf, release, ctx), true, 'Release не создаётся');
    });
}

test('release.yml: создание Release не зависит от выкатки и проверяет тег', () => {
    const wf = load('release.yml');
    const [release] = releaseJobs(wf);
    const deps = needsClosure(wf, release);
    for (const name of deployJobs(wf)) assert.ok(!deps.has(name), `Release ждёт ${name}`);
    assert.match(text(wf.jobs[release].steps), /--verify-tag/);
});

test('release.yml: ручной запуск из main — выкатка только после authorize по списку OWNER', () => {
    const wf = load('release.yml');
    const ctx = dispatch('v1.0.0');
    const [release] = releaseJobs(wf);
    assert.equal(runs(wf, release, ctx), false, 'ручной запуск не создаёт Release повторно');
    for (const name of deployJobs(wf)) {
        assert.equal(runs(wf, name, ctx), true, `${name} не запускается вручную`);
        const gate = [...needsClosure(wf, name)].filter((n) =>
            (wf.jobs[n].steps ?? []).some((s) =>
                /workflow-guards\.mjs authorize/.test(String(s.run ?? '')),
            ),
        );
        assert.ok(gate.length > 0, `${name} не зависит от job с workflow-guards.mjs authorize`);
        for (const g of gate) assert.equal(runs(wf, g, ctx), true, `${g} не запускается`);
    }
});

test('release.yml: ручной запуск не из main (workflow с чужой ветки) — выкатка пропущена', () => {
    const wf = load('release.yml');
    for (const ref of ['refs/heads/task/x', 'refs/tags/v1.0.0']) {
        for (const name of deployJobs(wf))
            assert.equal(runs(wf, name, dispatch('v1.0.0', { ref })), false, `${name} от ${ref}`);
    }
});

// ---------- authorize: кто и что может выкатить в production ----------

const authorize = (args, allowlist) => {
    const extra = [];
    if (allowlist !== undefined) {
        const dir = mkdtempSync(join(tmpdir(), 'deployers-'));
        const path = join(dir, 'deployers.txt');
        writeFileSync(path, allowlist);
        extra.push('--allowlist', path);
    }
    const r = spawnSync(process.execPath, [GUARDS, 'authorize', ...args, ...extra], {
        encoding: 'utf8',
    });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
};
const who = (actor, tag, triggering = actor) => [
    '--actor',
    actor,
    '--triggering-actor',
    triggering,
    '--tag',
    tag,
];

test('список выкатки production в репозитории — только trafficolog', () => {
    const logins = readFileSync(ALLOWLIST, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.replace(/#.*/, '').trim())
        .filter(Boolean);
    assert.deepEqual(logins, [OWNER]);
});

test('authorize: OWNER из списка и тег v1.0.0 — разрешено', () => {
    const r = authorize(who(OWNER, 'v1.0.0'));
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /разрешено/);
});

test('authorize: логин сравнивается без учёта регистра', () => {
    const r = authorize(who('TraffiColog', 'v1.2.3'));
    assert.equal(r.status, 0, r.out);
});

test('authorize: тег v0.* в production не выкатывается', () => {
    const r = authorize(who(OWNER, 'v0.1.0'));
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /v0/);
});

test('authorize: пользователь не из списка — отказ', () => {
    const r = authorize(who('stranger', 'v1.0.0'));
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /stranger/);
});

test('authorize: перезапуск чужим пользователем (triggering_actor) — отказ', () => {
    const r = authorize(who(OWNER, 'v1.0.0', 'stranger'));
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /stranger/);
});

for (const tag of [
    '',
    'v1',
    'v1.0',
    '1.0.0',
    'v1.0.0-rc.1',
    'v1.0.0; rm -rf /',
    'refs/tags/v1.0.0',
    'v01.0.0',
]) {
    test(`authorize: некорректный тег «${tag}» — отказ`, () => {
        const r = authorize(who(OWNER, tag));
        assert.equal(r.status, 1, r.out);
        assert.match(r.out, /тег/i);
    });
}

test('authorize: комментарии и пустые строки списка игнорируются, пустой список — отказ', () => {
    assert.equal(
        authorize(who('alice', 'v1.0.0'), '# выкатка production\n\nbob\nalice # OWNER\n').status,
        0,
    );
    const r = authorize(who(OWNER, 'v1.0.0'), '# никого\n\n');
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /пуст/);
});
