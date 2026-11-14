// Защита release.yml и deploy.yml без branch protection (задача 0.1.10, аудит G0: R1, R2).
// Проверяет условия `if` и `permissions` workflow, вычисляя их в контекстах событий GitHub,
// и команду authorize, которая пускает к выкатке production только OWNER из списка.
// Запуск: node --test .github/scripts/workflow-guards.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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
// Workflows с доступом к секретам выкатки (stage и production).
const DEPLOY_WORKFLOWS = ['deploy.yml', 'release.yml', 'provision.yml'];

// Job запускается, если истинно его `if` с учётом результатов needs (как в GitHub):
// need пропущен — 'skipped', need в failed — 'failure', иначе 'success'.
// `if` без статус-функции неявно требует success() — все needs успешны.
const runs = (wf, name, ctx, failed = new Set(), seen = new Set()) => {
    const job = wf.jobs[name];
    assert.ok(job, `нет job ${name}`);
    if (seen.has(name)) throw new Error(`цикл needs: ${name}`);
    const results = []
        .concat(job.needs ?? [])
        .map((n) =>
            !runs(wf, n, ctx, failed, new Set([...seen, name]))
                ? 'skipped'
                : failed.has(n)
                  ? 'failure'
                  : 'success',
        );
    return jobRuns(job, ctx, {
        success: results.every((r) => r === 'success'),
        failure: results.includes('failure'),
    });
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
const AUTHORIZE = /workflow-guards\.mjs authorize/;
// Job-пропуск выкатки — тот, где шаг запускает workflow-guards.mjs authorize.
const gateJobs = (wf) =>
    Object.keys(wf.jobs).filter((n) =>
        (wf.jobs[n].steps ?? []).some((s) => AUTHORIZE.test(String(s.run ?? ''))),
    );
const stepIndex = (job, re) => (job.steps ?? []).findIndex((s) => re.test(String(s.run ?? '')));
// Шаг проверки тега: тег существует (rev-parse --verify) и его коммит в origin/main.
const TAG_CHECK =
    /rev-parse --verify[^\n]*refs\/tags\/[\s\S]*merge-base --is-ancestor[^\n]*origin\/main/;
// Приёмы, которыми отказ проверки превращается в успех шага.
const SWALLOW =
    /\|\|\s*(true|:|exit\s+0)(?![\w-])|\bset\s+\+e\b|;\s*true\b|(^|\n|;|&&|\bthen)\s*exit\s+0\b/;

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
    for (const file of DEPLOY_WORKFLOWS) {
        const wf = load(file);
        for (const name of deployJobs(wf)) {
            assert.doesNotMatch(text(wf.jobs[name].permissions ?? {}), /write/, `${file}/${name}`);
        }
    }
});

// В run выражения ${{ }} не подставляются с вводом, событием, переменными и секретами — только через env.
const UNSAFE_IN_RUN =
    /\binputs\b|\bgithub\s*\.\s*event\b|\bgithub\s*\.\s*head_ref\b|\bvars\s*\.|\bsecrets\s*\./;
test('пользовательский ввод, vars и secrets не подставляются в run (только через env)', () => {
    for (const file of workflowFiles) {
        const wf = load(file);
        for (const [name, job] of Object.entries(wf.jobs)) {
            for (const step of job.steps ?? []) {
                for (const [expr] of String(step.run ?? '').matchAll(/\$\{\{[\s\S]*?\}\}/g)) {
                    assert.doesNotMatch(
                        expr,
                        UNSAFE_IN_RUN,
                        `${file}/${name}: ${step.name ?? step.run}`,
                    );
                }
            }
        }
    }
});

test('проверка внедрения ловит format(), toJSON(), vars и github.event в run', () => {
    for (const expr of [
        "${{ format('{0}', inputs.tag) }}",
        '${{ toJSON(github.event.inputs) }}',
        '${{ github.event.workflow_run.head_sha }}',
        '${{ vars.PRODUCTION_URL }}',
        '${{ secrets.DEPLOY_HOST }}',
    ]) {
        assert.match(expr, UNSAFE_IN_RUN, expr);
    }
    assert.doesNotMatch('${{ runner.os }}', UNSAFE_IN_RUN);
});

for (const file of DEPLOY_WORKFLOWS) {
    test(`${file}: нет триггеров pull_request, pull_request_target, workflow_call`, () => {
        const on = load(file).on;
        for (const trigger of ['pull_request', 'pull_request_target', 'workflow_call']) {
            assert.ok(!Object.hasOwn(on, trigger), `${file}: on.${trigger}`);
        }
    });
}

// Статус-функция в if снимает неявный success(): job идёт и при отказе authorize.
test('в if jobs выкатки и authorize нет статус-функций (always, cancelled, failure, success)', () => {
    for (const file of DEPLOY_WORKFLOWS) {
        const wf = load(file);
        for (const name of new Set([...deployJobs(wf), ...gateJobs(wf)])) {
            assert.doesNotMatch(
                String(wf.jobs[name].if ?? ''),
                /\b(always|cancelled|failure|success)\s*\(/,
                `${file}/${name}: if = ${wf.jobs[name].if}`,
            );
        }
    }
});

test('у jobs выкатки, authorize и release и их шагов нет continue-on-error и своего shell', () => {
    for (const file of DEPLOY_WORKFLOWS) {
        const wf = load(file);
        const names = new Set([...deployJobs(wf), ...gateJobs(wf), ...releaseJobs(wf)]);
        for (const name of names) {
            const job = wf.jobs[name];
            assert.ok(
                !Object.hasOwn(job, 'continue-on-error'),
                `${file}/${name}: continue-on-error`,
            );
            assert.ok(!job.defaults?.run?.shell, `${file}/${name}: defaults.run.shell`);
            for (const step of job.steps ?? []) {
                const label = `${file}/${name}: ${step.name ?? step.run ?? step.uses}`;
                assert.ok(!Object.hasOwn(step, 'continue-on-error'), `${label}: continue-on-error`);
                assert.ok(!Object.hasOwn(step, 'shell'), `${label}: shell (теряется bash -e)`);
            }
        }
    }
});

test('шаги authorize, проверки тега и Release не глушат ошибку (|| true, set +e, exit 0)', () => {
    const wf = load('release.yml');
    for (const name of new Set([...gateJobs(wf), ...releaseJobs(wf)])) {
        for (const step of wf.jobs[name].steps ?? []) {
            assert.doesNotMatch(
                String(step.run ?? ''),
                SWALLOW,
                `release.yml/${name}: ${step.name ?? step.run}`,
            );
        }
    }
});

test('приёмы глушения ошибки распознаются', () => {
    for (const run of [
        'node a.mjs authorize --tag "$TAG" || true',
        'node a.mjs authorize || :',
        'set +e\nnode a.mjs authorize',
        'node a.mjs authorize; true',
        'node a.mjs authorize\nexit 0',
        'git merge-base --is-ancestor a b || exit 0',
    ]) {
        assert.match(run, SWALLOW, run);
    }
    assert.doesNotMatch('git rev-parse x || { echo "::error::нет"; exit 1; }', SWALLOW);
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

test('release.yml: authorize отказал — выкатка пропущена', () => {
    const wf = load('release.yml');
    const ctx = dispatch('v0.1.0');
    const gates = gateJobs(wf);
    assert.ok(gates.length > 0, 'нет job с workflow-guards.mjs authorize');
    for (const name of deployJobs(wf)) {
        assert.equal(runs(wf, name, ctx, new Set(gates)), false, `${name} идёт после отказа`);
    }
});

test('release.yml: job выкатки напрямую зависит от authorize', () => {
    const wf = load('release.yml');
    for (const name of deployJobs(wf)) {
        const needs = [].concat(wf.jobs[name].needs ?? []);
        assert.ok(
            gateJobs(wf).some((g) => needs.includes(g)),
            `${name}: needs = ${needs.join(', ')}`,
        );
    }
});

test('release.yml: authorize проверяет, что тег существует и его коммит в main — после списка', () => {
    const wf = load('release.yml');
    for (const name of gateJobs(wf)) {
        const job = wf.jobs[name];
        const auth = stepIndex(job, AUTHORIZE);
        const check = stepIndex(job, TAG_CHECK);
        assert.ok(
            check >= 0,
            `${name}: нет шага rev-parse --verify тега и merge-base с origin/main`,
        );
        assert.ok(check > auth, `${name}: проверка тега идёт до authorize`);
        const checkout = job.steps.find((s) => /^actions\/checkout@/.test(String(s.uses ?? '')));
        assert.equal(checkout?.with?.['fetch-depth'], 0, `${name}: нужен fetch-depth: 0`);
    }
});

test('release.yml: выкатывается SHA, проверенный authorize, а не тег заново', () => {
    const wf = load('release.yml');
    const [gate] = gateJobs(wf);
    const job = wf.jobs[gate];
    const m = /^\$\{\{\s*steps\.([\w-]+)\.outputs\.sha\s*\}\}$/.exec(
        String(job.outputs?.sha ?? ''),
    );
    assert.ok(m, `${gate}: outputs.sha должен брать steps.<id>.outputs.sha`);
    const step = job.steps.find((s) => s.id === m[1]);
    assert.ok(step, `${gate}: нет шага id=${m[1]}`);
    assert.match(String(step.run), TAG_CHECK, 'SHA выдаёт шаг проверки тега');
    assert.match(
        String(step.run),
        /sha=[\s\S]*>>\s*"?\$GITHUB_OUTPUT"?/,
        'шаг пишет sha в GITHUB_OUTPUT',
    );
    for (const name of deployJobs(wf)) {
        const checkout = wf.jobs[name].steps.find((s) =>
            /^actions\/checkout@/.test(String(s.uses ?? '')),
        );
        assert.match(
            String(checkout?.with?.ref ?? ''),
            new RegExp(`^\\$\\{\\{\\s*needs\\.${gate}\\.outputs\\.sha\\s*\\}\\}$`),
            `${name}: checkout не по needs.${gate}.outputs.sha`,
        );
    }
});

test('release.yml: Release создаётся, только если коммит тега в main', () => {
    const wf = load('release.yml');
    const [name] = releaseJobs(wf);
    const job = wf.jobs[name];
    const check = stepIndex(job, /merge-base --is-ancestor[^\n]*origin\/main/);
    const create = stepIndex(job, /gh release create/);
    assert.ok(check >= 0, `${name}: нет проверки merge-base --is-ancestor с origin/main`);
    assert.ok(check < create, `${name}: проверка после gh release create`);
    assert.match(String(job.steps[check].run), /::error::/, 'понятный текст ошибки');
    const checkout = job.steps.find((s) => /^actions\/checkout@/.test(String(s.uses ?? '')));
    assert.equal(checkout?.with?.['fetch-depth'], 0, `${name}: нужен fetch-depth: 0`);
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

// ---------- выкатка stage по SSH (0.1.4) ----------

// SHA для deploy.sh — только из проверенного источника, одинаковый в checkout и env.SHA,
// в run — только "$SHA" (ревью PR #83, N9). Возвращает нарушения.
export const shaViolations = (wf, source) => {
    const expr = `\${{ ${source} }}`;
    const out = [];
    for (const name of deployJobs(wf)) {
        const steps = wf.jobs[name].steps ?? [];
        const deploys = steps.filter((s) =>
            /deploy\/deploy\.sh (stage|production)\b/.test(String(s.run ?? '')),
        );
        if (deploys.length === 0) out.push(`${name}: нет шага deploy/deploy.sh <окружение>`);
        const checkout = steps.find((s) => /^actions\/checkout@/.test(String(s.uses ?? '')));
        if (String(checkout?.with?.ref ?? '').replace(/\s+/g, ' ') !== expr)
            out.push(`${name}: checkout.ref = ${checkout?.with?.ref}, нужно ${expr}`);
        for (const step of deploys) {
            if (!/^\.\/deploy\/deploy\.sh (stage|production) "\$SHA"\n?$/.test(String(step.run)))
                out.push(`${name}: run = ${step.run}, нужно ./deploy/deploy.sh <окружение> "$SHA"`);
            if (String(step.env?.SHA ?? '').replace(/\s+/g, ' ') !== expr)
                out.push(`${name}: env.SHA = ${step.env?.SHA}, нужно ${expr}`);
        }
    }
    return out;
};

const SHA_SOURCES = {
    'deploy.yml': 'github.event.workflow_run.head_sha',
    'release.yml': 'needs.authorize.outputs.sha',
};
for (const [file, source] of Object.entries(SHA_SOURCES)) {
    test(`${file}: deploy.sh получает SHA только из ${source} — и в checkout, и в env.SHA`, () => {
        assert.deepEqual(shaViolations(load(file), source), []);
    });
}

const clone = (v) => JSON.parse(JSON.stringify(v));
const deployStep = (wf, job) =>
    wf.jobs[job].steps.find((s) =>
        /deploy\/deploy\.sh (stage|production)/.test(String(s.run ?? '')),
    );
const checkoutStep = (wf, job) =>
    wf.jobs[job].steps.find((s) => /^actions\/checkout@/.test(String(s.uses ?? '')));

test('проверка SHA ловит github.sha, расхождение checkout и SHA прямо в run', () => {
    const base = load('release.yml');
    const mutations = {
        'env.SHA = github.sha': (wf) => (deployStep(wf, 'deploy').env.SHA = '${{ github.sha }}'),
        'checkout по тегу': (wf) => (checkoutStep(wf, 'deploy').with.ref = '${{ inputs.tag }}'),
        'SHA литералом в run': (wf) =>
            (deployStep(wf, 'deploy').run = './deploy/deploy.sh production abc123'),
        'GITHUB_SHA в run': (wf) =>
            (deployStep(wf, 'deploy').run = './deploy/deploy.sh production "$GITHUB_SHA"'),
        'нет env.SHA': (wf) => delete deployStep(wf, 'deploy').env.SHA,
    };
    for (const [label, mutate] of Object.entries(mutations)) {
        const wf = clone(base);
        mutate(wf);
        assert.ok(shaViolations(wf, SHA_SOURCES['release.yml']).length > 0, label);
    }
});

// Шаги authorize не выключаются и передают ровно проверенные значения (ревью PR #83, N8).
const AUTHORIZE_RUN =
    'node .github/scripts/workflow-guards.mjs authorize --actor "$ACTOR" --triggering-actor "$TRIGGERING_ACTOR" --tag "$TAG"';
export const authorizeViolations = (wf) => {
    const out = [];
    const gates = gateJobs(wf);
    if (gates.length === 0) out.push('нет job с workflow-guards.mjs authorize');
    for (const name of gates) {
        for (const step of wf.jobs[name].steps ?? []) {
            if (Object.hasOwn(step, 'if'))
                out.push(`${name}: у шага «${step.name ?? step.run ?? step.uses}» есть if`);
        }
        const step = wf.jobs[name].steps.find((s) => AUTHORIZE.test(String(s.run ?? '')));
        if (String(step.run).trim() !== AUTHORIZE_RUN) out.push(`${name}: run = ${step.run}`);
        const want = {
            ACTOR: '${{ github.actor }}',
            TRIGGERING_ACTOR: '${{ github.triggering_actor }}',
            TAG: '${{ inputs.tag }}',
        };
        if (JSON.stringify(step.env ?? {}) !== JSON.stringify(want))
            out.push(`${name}: env = ${JSON.stringify(step.env)}`);
    }
    return out;
};

test('release.yml: шаги authorize без if, actor, triggering_actor и tag — из события, без --allowlist', () => {
    assert.deepEqual(authorizeViolations(load('release.yml')), []);
});

test('проверка authorize ловит if: false, литерал --tag, --allowlist /dev/stdin и подмену env', () => {
    const base = load('release.yml');
    const auth = (wf) => wf.jobs.authorize.steps.find((s) => AUTHORIZE.test(String(s.run ?? '')));
    const mutations = {
        'if: false у шага authorize': (wf) => (auth(wf).if = false),
        'if у проверки тега': (wf) => (wf.jobs.authorize.steps.at(-1).if = "inputs.tag != ''"),
        'литерал --tag': (wf) => (auth(wf).run = AUTHORIZE_RUN.replace('"$TAG"', 'v1.0.0')),
        '--allowlist /dev/stdin': (wf) =>
            (auth(wf).run = `${AUTHORIZE_RUN} --allowlist /dev/stdin`),
        'ACTOR из ввода': (wf) => (auth(wf).env.ACTOR = '${{ inputs.tag }}'),
        'лишняя переменная': (wf) => (auth(wf).env.EXTRA = 'x'),
    };
    for (const [label, mutate] of Object.entries(mutations)) {
        const wf = clone(base);
        mutate(wf);
        assert.ok(authorizeViolations(wf).length > 0, label);
    }
});

// Шаги, которые ходят на сервер по SSH: deploy.sh и provision.sh.
const sshSteps = (wf) =>
    Object.values(wf.jobs).flatMap((job) =>
        (job.steps ?? []).filter((s) =>
            /\.\/deploy\/(deploy|provision)\.sh /.test(String(s.run ?? '')),
        ),
    );

for (const file of DEPLOY_WORKFLOWS) {
    test(`${file}: SSH-шаги получают known_hosts из секрета DEPLOY_KNOWN_HOSTS`, () => {
        const steps = sshSteps(load(file));
        assert.ok(steps.length > 0, 'нет шагов deploy.sh / provision.sh');
        for (const step of steps) {
            assert.equal(
                step.env?.DEPLOY_KNOWN_HOSTS,
                '${{ secrets.DEPLOY_KNOWN_HOSTS }}',
                step.run,
            );
        }
    });
}

const KEY_CHECK = /case "\$KEY" in\s+"-----BEGIN OPENSSH PRIVATE KEY-----"\*\)/;
for (const file of ['deploy.yml', 'provision.yml']) {
    test(`${file}: перед ssh-agent проверяется формат ключа, значение не печатается`, () => {
        const wf = load(file);
        for (const name of deployJobs(wf)) {
            const steps = wf.jobs[name].steps;
            const agent = steps.findIndex((s) =>
                /^webfactory\/ssh-agent@/.test(String(s.uses ?? '')),
            );
            const check = steps.findIndex((s) => KEY_CHECK.test(String(s.run ?? '')));
            assert.ok(agent >= 0 && check >= 0 && check < agent, `${name}: проверка до ssh-agent`);
            assert.equal(steps[check].env?.KEY, '${{ secrets.DEPLOY_SSH_KEY }}');
            assert.equal(steps[check].if, steps[agent].if, 'проверка идёт вместе с ssh-agent');
            const mentions = String(steps[check].run).match(/\$\{?KEY\b/g) ?? [];
            assert.equal(mentions.length, 1, 'ключ используется только в case, не в echo');
        }
    });
}

test('deploy.yml: до STAGE_DEPLOY_LIVE=true — dry-run без SSH, после — выкатка и /health', () => {
    const wf = load('deploy.yml');
    const steps = wf.jobs.deploy.steps;
    const deploy = deployStep(wf, 'deploy');
    const agent = steps.find((s) => /^webfactory\/ssh-agent@/.test(String(s.uses ?? '')));
    const health = steps.find((s) => /\/health/.test(String(s.run ?? '')));
    assert.ok(!Object.hasOwn(deploy, 'if'), 'шаг deploy.sh идёт всегда (dry-run или выкатка)');
    for (const [vars, live] of [
        [{}, false],
        [{ STAGE_DEPLOY_LIVE: 'false' }, false],
        [{ STAGE_DEPLOY_LIVE: 'true' }, true],
    ]) {
        const ctx = { ...workflowRun(), vars, secrets: {} };
        assert.equal(evaluate(deploy.env.DEPLOY_DRY_RUN, ctx), live ? '0' : '1', text(vars));
        assert.equal(jobRuns(agent, ctx), live, 'ssh-agent');
        assert.equal(jobRuns(health, ctx), live, 'проверка /health');
    }
});

// ---------- provision.yml ----------

test('provision.yml: только ручной запуск с выбором provision или rollback', () => {
    const wf = load('provision.yml');
    assert.deepEqual(Object.keys(wf.on), ['workflow_dispatch']);
    const input = wf.on.workflow_dispatch.inputs.command;
    assert.equal(input.type, 'choice');
    assert.deepEqual(input.options, ['provision', 'rollback']);
});

// Ожидающий run в группе concurrency заменяется следующим: ручной откат не должен молча
// отменяться очередным мержем (ревью PR #96, п. 8). Откат — своя группа без отмены, выкатка
// и откат на сервере разводятся flock с ожиданием (deploy-scripts.test.mjs).
test('provision.yml: rollback — своя группа concurrency без отмены, provision — общая с deploy.yml', () => {
    const wf = load('provision.yml');
    assert.ok(!Object.hasOwn(wf, 'concurrency'), 'concurrency — на уровне job');
    const stage = load('deploy.yml').concurrency;
    assert.equal(stage, 'deploy-stage');
    for (const name of deployJobs(wf)) {
        const c = wf.jobs[name].concurrency;
        assert.equal(c?.['cancel-in-progress'], false, `${name}: cancel-in-progress: false`);
        const group = (command) =>
            evaluate(c.group, { ...dispatch('v1.0.0'), inputs: { command } });
        assert.equal(group('provision'), stage, 'provision в очереди deploy-stage');
        assert.equal(group('rollback'), 'stage-rollback', 'rollback в своей группе');
    }
});

test('provision.yml: job идёт только из main, окружение stage', () => {
    const wf = load('provision.yml');
    const jobs = deployJobs(wf);
    assert.ok(jobs.length > 0);
    for (const name of jobs) {
        assert.equal(wf.jobs[name].environment, 'stage', name);
        assert.equal(runs(wf, name, dispatch('v1.0.0')), true, `${name}: из main`);
        for (const ref of ['refs/heads/task/x', 'refs/tags/v1.0.0', 'refs/heads/main-x']) {
            assert.equal(runs(wf, name, dispatch('v1.0.0', { ref })), false, `${name} от ${ref}`);
        }
        assert.equal(runs(wf, name, workflowRun()), false, `${name}: не от workflow_run`);
    }
});

test('provision.yml: provision.sh remote и deploy.sh rollback stage — по выбору команды', () => {
    const wf = load('provision.yml');
    const steps = Object.values(wf.jobs).flatMap((j) => j.steps);
    const byRun = (cmd) => steps.find((s) => String(s.run ?? '').trim() === cmd);
    const provision = byRun('./deploy/provision.sh remote');
    const rollback = byRun('./deploy/deploy.sh rollback stage');
    assert.ok(provision && rollback, 'нет шагов provision.sh remote и deploy.sh rollback stage');
    for (const [command, p, r] of [
        ['provision', true, false],
        ['rollback', false, true],
    ]) {
        const ctx = { ...dispatch('v1.0.0'), inputs: { command } };
        assert.equal(jobRuns(provision, ctx), p, `provision при ${command}`);
        assert.equal(jobRuns(rollback, ctx), r, `rollback при ${command}`);
    }
});

// ---------- ci.yml: экономия минут (0.1.17) ----------
// docs-only изменения не гоняют php/js/e2e; e2e — на push в main и по workflow_dispatch (перед мержем).

const ciEvent = (event_name, ref) => ({
    github: { event_name, repository: REPO, ref, event: {} },
});
const ciJobs = (event_name, code) => {
    const wf = load('ci.yml');
    const ctx = {
        ...ciEvent(event_name, 'refs/heads/x'),
        needs: { changes: { outputs: { code } } },
    };
    return ['changes', 'docs', 'php', 'js', 'e2e'].filter((n) => runs(wf, n, ctx));
};

test('ci.yml: триггеры — PR (типы по умолчанию), push в main, workflow_dispatch', () => {
    const on = load('ci.yml').on;
    assert.ok(Object.hasOwn(on, 'pull_request'));
    assert.ok(!on.pull_request?.types, 'на PR не должно быть labeled и других типов');
    assert.deepEqual(on.push.branches, ['main']);
    assert.ok(Object.hasOwn(on, 'workflow_dispatch'));
});

test('ci.yml: job changes без сторонних actions, результат в выходе code', () => {
    const job = load('ci.yml').jobs.changes;
    assert.ok(job, 'нет job changes');
    for (const step of job.steps) {
        if (step.uses)
            assert.match(step.uses, /^actions\/checkout@/, `сторонний action: ${step.uses}`);
    }
    assert.match(text(job), /event\.before/);
    assert.match(text(job.outputs), /code/);
});

test('ci.yml: docs-only (code=false) — для любого события только docs', () => {
    for (const event of ['push', 'pull_request', 'workflow_dispatch'])
        assert.deepEqual(ciJobs(event, 'false'), ['changes', 'docs'], event);
});

test('ci.yml: код — push и dispatch запускают e2e, PR без e2e', () => {
    assert.deepEqual(ciJobs('push', 'true'), ['changes', 'docs', 'php', 'js', 'e2e']);
    assert.deepEqual(ciJobs('workflow_dispatch', 'true'), ['changes', 'docs', 'php', 'js', 'e2e']);
    assert.deepEqual(ciJobs('pull_request', 'true'), ['changes', 'docs', 'php', 'js']);
});

test('ci.yml: метки на CI не влияют, concurrency — ci-<ref>, отмена только на PR', () => {
    const wf = load('ci.yml');
    assert.doesNotMatch(text(wf), /labeled|\bready\b|\blabels\b/);
    const pr = ciEvent('pull_request', 'refs/pull/7/merge');
    const push = ciEvent('push', 'refs/heads/main');
    assert.equal(wf.concurrency.group, 'ci-${{ github.ref }}');
    assert.equal(evaluate(wf.concurrency['cancel-in-progress'], pr), true);
    assert.equal(evaluate(wf.concurrency['cancel-in-progress'], push), false);
    assert.equal(
        evaluate(wf.concurrency['cancel-in-progress'], ciEvent('workflow_dispatch', 'refs/heads/x')),
        false,
    );
});

test('ci.yml: deploy.yml стартует только по conclusion == success', () => {
    // Пропущенные jobs не делают прогон failure: conclusion остаётся success, а docs-only
    // коммит в main (без php/js/e2e) тоже даёт success — выкатка для него безвредна (тот же код).
    assert.equal(runs(load('deploy.yml'), 'deploy', workflowRun({ conclusion: 'success' })), true);
    assert.equal(runs(load('deploy.yml'), 'deploy', workflowRun({ conclusion: 'skipped' })), false);
});

// Скрипт job changes запускается на настоящем git-репозитории.
const changesScript = () => {
    const step = load('ci.yml').jobs.changes.steps.find((s) =>
        /git diff/.test(String(s.run ?? '')),
    );
    assert.ok(step, 'нет шага git diff в job changes');
    return step.run;
};
const gitIn = (dir, ...args) =>
    spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
        encoding: 'utf8',
    });
// event: pull_request сравнивает HEAD^1 с HEAD (merge-ref), push — с BEFORE_SHA, прочее — code=true.
const codeFor = (files, { event = 'pull_request', before = 'good', commits = 2 } = {}) => {
    const dir = mkdtempSync(join(tmpdir(), 'changes-'));
    gitIn(dir, 'init', '-q');
    let baseSha = null;
    if (commits > 1) {
        writeFileSync(join(dir, 'README.md'), 'x');
        gitIn(dir, 'add', '.');
        gitIn(dir, 'commit', '-qm', 'base');
        baseSha = gitIn(dir, 'rev-parse', 'HEAD').stdout.trim();
    }
    for (const f of files) {
        mkdirSync(dirname(join(dir, f)), { recursive: true });
        writeFileSync(join(dir, f), 'y');
    }
    gitIn(dir, 'add', '-A');
    gitIn(dir, 'commit', '-qm', 'change', '--allow-empty');
    const out = join(dir, 'gh-output');
    writeFileSync(out, '');
    const res = spawnSync('bash', ['-c', changesScript()], {
        cwd: dir,
        encoding: 'utf8',
        env: {
            ...process.env,
            EVENT_NAME: event,
            BEFORE_SHA: before === 'good' ? baseSha : before,
            GITHUB_OUTPUT: out,
        },
    });
    assert.equal(res.status, 0, res.stderr);
    return readFileSync(out, 'utf8').trim();
};

test('changes: docs/** и *.md в корне — code=false (PR и push)', () => {
    for (const event of ['pull_request', 'push']) {
        assert.equal(codeFor(['docs/a/b.md', 'docs/x.json', 'AGENTS.md'], { event }), 'code=false');
        assert.equal(codeFor([], { event }), 'code=false');
    }
});

test('changes: любой другой файл — code=true (PR и push)', () => {
    for (const event of ['pull_request', 'push']) {
        assert.equal(codeFor(['docs/a.md', 'app/Foo.php'], { event }), 'code=true');
        assert.equal(codeFor(['sub/README.md'], { event }), 'code=true');
        assert.equal(codeFor(['.github/workflows/ci.yml'], { event }), 'code=true');
    }
});

test('changes: PR сравнивается с первым родителем merge-ref, без родителя — code=true', () => {
    assert.equal(codeFor(['docs/a.md'], { event: 'pull_request', commits: 1 }), 'code=true');
});

test('changes: push без базы (пусто, нули, неизвестный коммит) — code=true', () => {
    for (const before of ['', '0'.repeat(40), 'f'.repeat(40)])
        assert.equal(codeFor(['docs/a.md'], { event: 'push', before }), 'code=true', before);
});

test('changes: workflow_dispatch — всегда code=true', () => {
    assert.equal(codeFor(['docs/a.md'], { event: 'workflow_dispatch' }), 'code=true');
});
