// Скрипты выкатки и подготовки stage (задача 0.1.4): deploy/deploy.sh, deploy/provision.sh, шаблоны.
// Проверяются без сервера: shellcheck, разбор шаблонов, dry-run, выкатка и откат в песочнице
// (временный APP_ROOT и заглушки php, composer, npm, curl, sudo, ssh вместо настоящих команд).
// Запуск: node --test .github/scripts/deploy-scripts.test.mjs (bash-тесты — на Linux и macOS).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    readlinkSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEPLOY = join(ROOT, 'deploy');
const WORKFLOWS = join(ROOT, '.github', 'workflows');
const read = (...p) => readFileSync(join(...p), 'utf8');
const POSIX = process.platform !== 'win32';
const bashOnly = { skip: POSIX ? false : 'bash-тесты — на Linux (CI) и macOS' };

const listFiles = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)],
    );
const SCRIPTS = ['deploy.sh', 'provision.sh', 'lib.sh', 'bin/worker.sh'];

// Секреты-метки: ни одна не должна появиться в выводе скриптов.
const SECRETS = {
    APP_KEY: 'base64:SECRET-app-key-0001',
    DB_PASSWORD: 'SECRET-db-0002',
    MEILISEARCH_KEY: 'SECRET-meili-0003',
    AWS_ACCESS_KEY_ID: 'ymapp',
    AWS_SECRET_ACCESS_KEY: 'SECRET-aws-0004',
    MINIO_ROOT_USER: 'SECRET-minio-user-0005',
    MINIO_ROOT_PASSWORD: 'SECRET-minio-0006',
    STAGE_BASIC_AUTH_USER: 'stage',
    STAGE_BASIC_AUTH_PASSWORD: 'SECRET-basic-0007',
    MAILPIT_UI_USER: 'mail',
    MAILPIT_UI_PASSWORD: 'SECRET-mailpit-0008',
    REVERB_APP_ID: '100001',
    REVERB_APP_KEY: 'reverb-public-key',
    REVERB_APP_SECRET: 'SECRET-reverb-0009',
};
const secretValues = Object.values(SECRETS).filter((v) => v.includes('SECRET'));
const assertNoSecrets = (out) => {
    for (const s of secretValues) assert.ok(!out.includes(s), `в выводе секрет ${s}`);
};

const bash = (args, { env = {}, cwd = ROOT, input } = {}) => {
    const r = spawnSync('bash', args, {
        cwd,
        input,
        encoding: 'utf8',
        env: {
            PATH: process.env.PATH,
            HOME: process.env.HOME ?? tmpdir(),
            LANG: 'C.UTF-8',
            ...env,
        },
    });
    return { status: r.status, out: `${r.stdout}${r.stderr}`, stdout: r.stdout };
};

// ---------- статические проверки ----------

test('скрипты deploy/ — LF, shebang bash, set -euo pipefail', () => {
    for (const file of listFiles(DEPLOY)) {
        assert.ok(!read(file).includes('\r'), `${file}: CRLF`);
    }
    for (const name of SCRIPTS) {
        const src = read(DEPLOY, name);
        assert.match(src, /^#!\/usr\/bin\/env bash\n/, `${name}: shebang`);
        if (name !== 'lib.sh')
            assert.match(src, /\nset -E?euo pipefail\n/, `${name}: set -euo pipefail`);
    }
});

test('у исполняемых скриптов в git стоит бит +x', () => {
    const r = spawnSync('git', ['ls-files', '-s', 'deploy'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    for (const name of ['deploy.sh', 'provision.sh', 'bin/worker.sh']) {
        const line = r.stdout.split('\n').find((l) => l.endsWith(`\tdeploy/${name}`));
        assert.ok(line, `deploy/${name} не в git`);
        assert.match(
            line,
            /^100755 /,
            `deploy/${name}: нет +x в git (git update-index --chmod=+x)`,
        );
    }
});

test(
    'shellcheck без замечаний',
    { skip: hasShellcheck() ? false : !process.env.CI && 'нет shellcheck (в CI обязателен)' },
    () => {
        const r = spawnSync('shellcheck', ['-x', ...SCRIPTS.map((s) => `deploy/${s}`)], {
            cwd: ROOT,
            encoding: 'utf8',
        });
        assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
    },
);
function hasShellcheck() {
    return spawnSync('shellcheck', ['--version']).status === 0;
}

// Блок location PATH из конфига Nginx (без вложенных фигурных скобок).
const nginxLocation = (conf, path) => {
    const m = new RegExp(
        `location ${path.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')} \\{([^}]*)\\}`,
    ).exec(conf);
    assert.ok(m, `нет location ${path}`);
    return m[1];
};

test('Nginx: /build — кэш на год с immutable, /fonts — на год без immutable', () => {
    const conf = read(DEPLOY, 'nginx', 'ymuzykant.conf');
    const build = nginxLocation(conf, '/build/');
    assert.match(build, /add_header Cache-Control "public, max-age=31536000, immutable" always;/);
    const fonts = nginxLocation(conf, '/fonts/');
    assert.match(fonts, /add_header Cache-Control "public, max-age=31536000" always;/);
    assert.doesNotMatch(fonts, /immutable/, 'шрифты без хеша в имени — без immutable');
    // add_header в location отменяет заголовки из server — их нужно подключить заново.
    for (const block of [build, fonts])
        assert.match(block, /include \/etc\/nginx\/ymuzykant\/security-headers\.conf;/);
});

test('Nginx: stage за паролем, /health и /up открыты, Mailpit — свой пароль', () => {
    const conf = read(DEPLOY, 'nginx', 'ymuzykant.conf');
    assert.match(conf, /auth_basic_user_file \/etc\/nginx\/ymuzykant\/stage\.htpasswd;/);
    for (const p of ['= /health', '= /up']) assert.match(nginxLocation(conf, p), /auth_basic off;/);
    const mailpit = nginxLocation(conf, '/_mailpit/');
    assert.match(mailpit, /auth_basic_user_file \/etc\/nginx\/ymuzykant\/mailpit\.htpasswd;/);
    assert.match(mailpit, /proxy_pass http:\/\/127\.0\.0\.1:8025;/);
    assert.match(conf, /return 301 https:\/\/\$host\$request_uri;/, 'HTTP → HTTPS');
    assert.match(conf, /ssl_certificate \/etc\/letsencrypt\/live\/__DOMAIN__\/fullchain\.pem;/);
    assert.match(
        conf,
        /fastcgi_param SCRIPT_FILENAME \$realpath_root\$fastcgi_script_name;/,
        'путь релиза, а не симлинка current',
    );
});

test('Supervisor: очередь high,default (Horizon или queue:work), Reverb, SSR, планировщик — не от root', () => {
    const conf = read(DEPLOY, 'supervisor', 'ymuzykant.conf');
    assert.match(
        conf,
        /programs=ymuzykant-queue,ymuzykant-reverb,ymuzykant-ssr,ymuzykant-scheduler/,
    );
    for (const [program, role] of [
        ['queue', 'queue'],
        ['reverb', 'reverb'],
        ['ssr', 'ssr'],
        ['scheduler', 'scheduler'],
    ]) {
        const block = conf.split(`[program:ymuzykant-${program}]`)[1]?.split('\n[')[0] ?? '';
        assert.match(
            block,
            new RegExp(`command=/bin/bash __APP_ROOT__/current/deploy/bin/worker\\.sh ${role}\\n`),
            program,
        );
        assert.match(block, /\nuser=__USER__\n/, `${program}: user`);
        assert.match(block, /\nautorestart=true\n/, `${program}: autorestart`);
    }
    const worker = read(DEPLOY, 'bin', 'worker.sh');
    assert.match(worker, /has_command horizon; then exec php artisan horizon;/);
    assert.match(worker, /queue:work redis --queue=high,default /);
    assert.match(worker, /reverb:start --host=127\.0\.0\.1 --port=8080/);
    assert.match(worker, /inertia:start-ssr/);
});

test('сервисы в Docker слушают только 127.0.0.1', () => {
    const compose = read(DEPLOY, 'services.compose.yaml');
    const ports = [...compose.matchAll(/^\s+- "([^"]+)"$/gm)].map((m) => m[1]);
    assert.ok(ports.length >= 4, 'нет портов');
    for (const p of ports) assert.match(p, /^127\.0\.0\.1:\d+:\d+$/, p);
    assert.match(
        compose,
        /MEILI_MASTER_KEY: \$\{MEILISEARCH_KEY:\?\}/,
        'ключ Meilisearch из окружения',
    );
    assert.match(compose, /MP_WEBROOT: _mailpit/);
});

test('SSH: ключ сервера только из DEPLOY_KNOWN_HOSTS — без ssh-keyscan и StrictHostKeyChecking no', () => {
    const sources = [
        ...listFiles(DEPLOY).map((f) => [f, read(f)]),
        ...readdirSync(WORKFLOWS).map((f) => [f, read(WORKFLOWS, f)]),
    ].map(([f, src]) => [f, src.replace(/^\s*#.*$/gm, '')]); // комментарии не в счёт
    for (const [file, src] of sources) {
        assert.doesNotMatch(src, /ssh-keyscan/, `${file}: ssh-keyscan`);
        assert.doesNotMatch(
            src,
            /StrictHostKeyChecking[= ]+(no|accept-new|off)/i,
            `${file}: StrictHostKeyChecking`,
        );
    }
    const lib = read(DEPLOY, 'lib.sh');
    assert.match(lib, /-o StrictHostKeyChecking=yes/);
    assert.match(lib, /-o "UserKnownHostsFile=\$dir\/known_hosts"/);
    assert.match(lib, /-o PasswordAuthentication=no/);
});

test('provision.sh не меняет sshd (это задача 0.1.12) и не даёт пользователю деплоя полный sudo', () => {
    const src = read(DEPLOY, 'provision.sh');
    assert.doesNotMatch(src, /sshd_config|PermitRootLogin|systemctl (reload|restart) ssh/);
    const sudoers = [...src.matchAll(/^\$\{DEPLOY_USER\} ALL=\(root\) NOPASSWD: (.+)$/gm)].map(
        (m) => m[1],
    );
    assert.ok(sudoers.length > 0, 'нет правил sudoers');
    for (const rule of sudoers) {
        assert.match(
            rule,
            /^\/usr\/bin\/(systemctl reload php\$\{PHP_VERSION\}-fpm|supervisorctl (status|restart|start) ymuzykant\\\\:\*)$/,
            rule,
        );
    }
});

// ---------- .env из секретов ----------

const envLine = (key, value) =>
    bash(['-c', 'source deploy/lib.sh; env_line "$1" "$2"', '_', key, value]);

test('env_line: значения в кавычках без подстановок, отказ без печати значения', bashOnly, () => {
    assert.equal(envLine('A', 'plain').stdout, "A='plain'\n");
    assert.equal(
        envLine('A', 'p$a${B}s"\\').stdout,
        "A='p$a${B}s\"\\'\n",
        'одинарные кавычки — буквально',
    );
    assert.equal(envLine('A', "it's").stdout, 'A="it\'s"\n');
    assert.equal(envLine('A', '').stdout, "A=''\n");
    for (const bad of ["it's $x", 'a\nb']) {
        const r = envLine('A', bad);
        assert.equal(r.status, 1, bad);
        assert.ok(!r.out.includes(bad), 'значение не печатается');
    }
    assert.equal(envLine('a-b', 'x').status, 1, 'имя переменной');
});

// ---------- deploy.sh на раннере ----------

// Временный git-репозиторий с копией deploy/: deploy.sh сверяет SHA с HEAD и упаковывает git archive.
const fakeRepo = () => {
    const dir = mkdtempSync(join(tmpdir(), 'ym-repo-'));
    cpSync(DEPLOY, join(dir, 'deploy'), { recursive: true });
    const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
    git('init', '-q');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'x');
    return { dir, sha: git('rev-parse', 'HEAD').stdout.trim() };
};

// Каталог заглушек команд; каждая пишет вызов в $STUB_LOG.
const stubBin = () => {
    const bin = mkdtempSync(join(tmpdir(), 'ym-bin-'));
    const stub = (name, body) => {
        writeFileSync(
            join(bin, name),
            `#!/usr/bin/env bash\nprintf '%s\\n' "${name} $*" >> "$STUB_LOG"\n${body}\n`,
        );
        chmodSync(join(bin, name), 0o755);
    };
    stub(
        'php',
        `if [[ "$*" == "artisan list --raw" ]]; then for c in \${STUB_COMMANDS:-}; do printf '%s  описание\\n' "$c"; done; exit 0; fi
[[ "$*" == "artisan migrate --force" && \${STUB_FAIL:-} == *migrate* ]] && { echo "SQLSTATE: ошибка миграции" >&2; exit 1; }
[[ "$*" == "artisan horizon:status" ]] && echo "Horizon is running."
exit 0`,
    );
    stub('composer', 'exit 0');
    stub('npm', 'exit 0');
    stub(
        'curl',
        `[[ "$*" == *"/health"* && "$*" == *"--resolve"* && \${STUB_FAIL:-} == *health* ]] && exit 22
[[ "$*" == *"13714/health"* && \${STUB_FAIL:-} == *ssr* ]] && exit 7
exit 0`,
    );
    stub(
        'sudo',
        `if [[ "$*" == "-n supervisorctl status ymuzykant:*" ]]; then
  for p in queue reverb ssr scheduler; do
    s=RUNNING; [[ $p == ssr && \${STUB_FAIL:-} == *ssr* ]] && s=FATAL
    printf 'ymuzykant:ymuzykant-%s %s pid 1, uptime 0:00:05\\n' "$p" "$s"
  done
fi
exit 0`,
    );
    stub('ssh', 'cat > /dev/null; exit 0');
    return bin;
};

const runnerEnv = (bin, extra = {}) => ({
    PATH: `${bin}:${process.env.PATH}`,
    STUB_LOG: join(bin, 'calls.log'),
    APP_URL: 'https://stage.example.test',
    DEPLOY_HOST: 'stage.example.test',
    DEPLOY_USER: 'ymdeploy',
    DEPLOY_KNOWN_HOSTS: 'stage.example.test ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFakeKeyForTests',
    ...SECRETS,
    ...extra,
});
const calls = (bin) => (existsSync(join(bin, 'calls.log')) ? read(bin, 'calls.log') : '');

test('deploy.sh: неизвестное окружение и SHA не из 40 hex — отказ', bashOnly, () => {
    const { dir, sha } = fakeRepo();
    const bin = stubBin();
    for (const args of [
        ['production2', sha],
        ['stage', sha.slice(0, 12)],
        ['stage', `${sha.slice(0, 39)}Z`],
        ['stage', `${sha}; rm -rf /`],
    ]) {
        const r = bash(['deploy/deploy.sh', ...args], { cwd: dir, env: runnerEnv(bin) });
        assert.notEqual(r.status, 0, `${args.join(' ')}: ${r.out}`);
    }
    assert.doesNotMatch(calls(bin), /^ssh /m, 'ssh не вызывался');
});

test('deploy.sh: SHA не совпадает с HEAD checkout — отказ до SSH', bashOnly, () => {
    const { dir } = fakeRepo();
    const bin = stubBin();
    const r = bash(['deploy/deploy.sh', 'stage', 'a'.repeat(40)], {
        cwd: dir,
        env: runnerEnv(bin),
    });
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /проверенного источника/);
    assert.doesNotMatch(calls(bin), /^ssh /m);
});

test(
    'deploy.sh: dry-run собирает релиз и .env, ничего не отправляет и не печатает секретов',
    bashOnly,
    () => {
        const { dir, sha } = fakeRepo();
        const bin = stubBin();
        const r = bash(['deploy/deploy.sh', 'stage', sha], {
            cwd: dir,
            env: runnerEnv(bin, { DEPLOY_DRY_RUN: '1' }),
        });
        assert.equal(r.status, 0, r.out);
        assert.match(r.out, /DRY-RUN stage: релиз \d{14}-[0-9a-f]{12}/);
        for (const key of [
            'APP_KEY',
            'DB_PASSWORD',
            'MEILISEARCH_KEY',
            'AWS_SECRET_ACCESS_KEY',
            'REVERB_APP_SECRET',
        ]) {
            assert.match(r.out, new RegExp(`\\b${key}\\b`), `.env без ${key}`);
        }
        assertNoSecrets(r.out);
        assert.doesNotMatch(calls(bin), /^ssh /m, 'dry-run не ходит на сервер');
    },
);

test(
    'deploy.sh: dry-run без секретов (до 0.1.12) — предупреждение с именами, успех',
    bashOnly,
    () => {
        const { dir, sha } = fakeRepo();
        const bin = stubBin();
        const env = {
            PATH: `${bin}:${process.env.PATH}`,
            STUB_LOG: join(bin, 'calls.log'),
            DEPLOY_DRY_RUN: '1',
        };
        const r = bash(['deploy/deploy.sh', 'stage', sha], { cwd: dir, env });
        assert.equal(r.status, 0, r.out);
        assert.match(r.out, /::warning::DRY-RUN: не заданы APP_URL APP_KEY DB_PASSWORD/);
    },
);

test('deploy.sh: без секретов и без dry-run — отказ с именами, без SSH', bashOnly, () => {
    const { dir, sha } = fakeRepo();
    const bin = stubBin();
    const r = bash(['deploy/deploy.sh', 'stage', sha], {
        cwd: dir,
        env: runnerEnv(bin, { DB_PASSWORD: '' }),
    });
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /не заданы переменные: DB_PASSWORD/);
    assert.doesNotMatch(calls(bin), /^ssh /m);
});

test('deploy.sh: нет DEPLOY_KNOWN_HOSTS — отказ до SSH', bashOnly, () => {
    const { dir, sha } = fakeRepo();
    const bin = stubBin();
    const r = bash(['deploy/deploy.sh', 'stage', sha], {
        cwd: dir,
        env: runnerEnv(bin, { DEPLOY_KNOWN_HOSTS: '' }),
    });
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /DEPLOY_KNOWN_HOSTS/);
    assert.doesNotMatch(calls(bin), /^ssh /m);
});

test(
    'deploy.sh: выкатка идёт по SSH с проверкой known_hosts, секреты не в аргументах',
    bashOnly,
    () => {
        const { dir, sha } = fakeRepo();
        const bin = stubBin();
        const r = bash(['deploy/deploy.sh', 'stage', sha], { cwd: dir, env: runnerEnv(bin) });
        assert.equal(r.status, 0, r.out);
        const ssh = calls(bin)
            .split('\n')
            .filter((l) => l.startsWith('ssh '));
        assert.equal(ssh.length, 3, 'загрузка, .env, server-release');
        for (const line of ssh) {
            assert.match(line, /-o StrictHostKeyChecking=yes/);
            assert.match(line, /-o UserKnownHostsFile=\S+known_hosts/);
            assert.match(line, /-o BatchMode=yes/);
            assert.match(line, / ymdeploy@stage\.example\.test /);
        }
        assert.match(ssh[2], /deploy\/deploy\.sh server-release \d{14}-[0-9a-f]{12}$/);
        assertNoSecrets(calls(bin));
        assertNoSecrets(r.out);
    },
);

test('deploy.sh rollback stage — откат на сервере по SSH', bashOnly, () => {
    const { dir } = fakeRepo();
    const bin = stubBin();
    const r = bash(['deploy/deploy.sh', 'rollback', 'stage'], { cwd: dir, env: runnerEnv(bin) });
    assert.equal(r.status, 0, r.out);
    assert.match(
        calls(bin),
        /^ssh .*StrictHostKeyChecking=yes.* bash \/var\/www\/ymuzykant\/current\/deploy\/deploy\.sh rollback$/m,
    );
});

// ---------- deploy.sh на сервере: песочница APP_ROOT ----------

const RELEASES = ['20261101100000-aaaaaaaaaaaa', '20261102100000-bbbbbbbbbbbb'];
const NEW = '20261103100000-cccccccccccc';

// APP_ROOT с двумя выкаченными релизами (current → второй) и распакованным новым.
const sandbox = ({ withModel = false, releases = RELEASES } = {}) => {
    const root = mkdtempSync(join(tmpdir(), 'ym-app-'));
    mkdirSync(join(root, 'shared', 'storage'), { recursive: true });
    writeFileSync(join(root, 'shared', '.env'), "APP_URL='https://stage.example.test'\n");
    for (const id of [...releases, NEW]) {
        cpSync(DEPLOY, join(root, 'releases', id, 'deploy'), { recursive: true });
        mkdirSync(join(root, 'releases', id, 'storage'), { recursive: true });
        if (withModel) {
            const model = join(root, 'releases', id, 'app', 'Domain', 'Catalog', 'Models');
            mkdirSync(model, { recursive: true });
            writeFileSync(join(model, 'InstrumentModel.php'), '<?php\n');
        }
    }
    if (releases.length) symlinkSync(`releases/${releases.at(-1)}`, join(root, 'current'));
    return root;
};
const current = (root) => basename(readlinkSync(join(root, 'current')));
const serverEnv = (bin, root, extra = {}) => ({
    PATH: `${bin}:${process.env.PATH}`,
    STUB_LOG: join(bin, 'calls.log'),
    DEPLOY_APP_ROOT: root,
    DEPLOY_SETTLE_SECONDS: '0',
    DEPLOY_HEALTH_RETRIES: '2',
    ...extra,
});
const serverRelease = (root, bin, extra) =>
    bash([join(root, 'releases', NEW, 'deploy', 'deploy.sh'), 'server-release', NEW], {
        cwd: root,
        env: serverEnv(bin, root, extra),
    });
const order = (log, ...needles) => {
    let at = -1;
    for (const n of needles) {
        const i = log.indexOf(n, at + 1);
        assert.ok(i > at, `«${n}» не после предыдущего шага:\n${log}`);
        at = i;
    }
};

test(
    'server-release: сборка, миграции, кэши, переключение, перезапуск, проверка процессов',
    bashOnly,
    () => {
        const root = sandbox();
        const bin = stubBin();
        const r = serverRelease(root, bin);
        assert.equal(r.status, 0, r.out);
        assert.equal(current(root), NEW);
        assert.equal(
            readlinkSync(join(root, 'releases', NEW, '.env')),
            join(root, 'shared', '.env'),
        );
        assert.equal(
            readlinkSync(join(root, 'releases', NEW, 'storage')),
            join(root, 'shared', 'storage'),
        );
        const log = calls(bin);
        order(
            log,
            'composer install --no-dev',
            'npm ci',
            'npm run build\n',
            'npm run build:ssr',
            'php artisan migrate --force',
            'php artisan config:cache',
            'php artisan route:cache',
            'sudo -n systemctl reload php8.3-fpm',
            'php artisan queue:restart',
            'sudo -n supervisorctl restart ymuzykant:ymuzykant-ssr',
            'curl -fsS --max-time 5 -o /dev/null --resolve stage.example.test:443:127.0.0.1 https://stage.example.test/health',
            'sudo -n supervisorctl status ymuzykant:*',
            'curl -fsS --max-time 5 -o /dev/null http://127.0.0.1:13714/health',
        );
        assert.doesNotMatch(
            log,
            /horizon:terminate|reverb:restart|scout:/,
            'Horizon, Reverb, Scout не установлены',
        );
    },
);

test('server-release: Horizon, Reverb и Scout установлены — их шаги выполняются', bashOnly, () => {
    const root = sandbox({ withModel: true });
    const bin = stubBin();
    const commands =
        'horizon horizon:terminate horizon:status reverb:start reverb:restart scout:sync-index-settings scout:import';
    const r = serverRelease(root, bin, { STUB_COMMANDS: commands });
    assert.equal(r.status, 0, r.out);
    const log = calls(bin);
    order(
        log,
        'php artisan migrate --force',
        'php artisan scout:sync-index-settings',
        'php artisan scout:import App\\Domain\\Catalog\\Models\\InstrumentModel',
        'php artisan horizon:terminate',
        'php artisan reverb:restart',
        'php artisan horizon:status',
    );
    assert.doesNotMatch(log, /queue:restart/);
});

test('server-release: класса модели нет в релизе — scout:import пропускается', bashOnly, () => {
    const root = sandbox();
    const bin = stubBin();
    const r = serverRelease(root, bin, { STUB_COMMANDS: 'scout:sync-index-settings scout:import' });
    assert.equal(r.status, 0, r.out);
    assert.match(calls(bin), /artisan scout:sync-index-settings/);
    assert.doesNotMatch(calls(bin), /scout:import/);
});

test(
    'server-release: падение миграции отменяет переключение, недособранный релиз удалён',
    bashOnly,
    () => {
        const root = sandbox();
        const bin = stubBin();
        const r = serverRelease(root, bin, { STUB_FAIL: 'migrate' });
        assert.notEqual(r.status, 0, r.out);
        assert.equal(current(root), RELEASES[1], 'current не изменился');
        assert.ok(!existsSync(join(root, 'releases', NEW)), 'релиз удалён');
        assert.match(r.out, /не выкачен, current остался на 20261102100000-bbbbbbbbbbbb/);
        assert.doesNotMatch(
            calls(bin),
            /config:cache|supervisorctl|systemctl/,
            'после миграции ничего не делается',
        );
    },
);

test('server-release: /health не ответил — автоматический откат на прежний релиз', bashOnly, () => {
    const root = sandbox();
    const bin = stubBin();
    const r = serverRelease(root, bin, { STUB_FAIL: 'health' });
    assert.equal(r.status, 1, r.out);
    assert.equal(current(root), RELEASES[1]);
    assert.match(r.out, /откат на 20261102100000-bbbbbbbbbbbb/);
});

test('server-release: SSR не в RUNNING — откат', bashOnly, () => {
    const root = sandbox();
    const bin = stubBin();
    const r = serverRelease(root, bin, { STUB_FAIL: 'ssr' });
    assert.equal(r.status, 1, r.out);
    assert.equal(current(root), RELEASES[1]);
    assert.match(r.out, /ymuzykant-ssr не в состоянии RUNNING/);
});

test('server-release: первый релиз (current ещё нет) и неверный id', bashOnly, () => {
    const root = sandbox({ releases: [] });
    const bin = stubBin();
    assert.equal(serverRelease(root, bin).status, 0);
    assert.equal(current(root), NEW);
    const bad = bash(
        [join(root, 'releases', NEW, 'deploy', 'deploy.sh'), 'server-release', '../etc'],
        {
            env: serverEnv(bin, root),
        },
    );
    assert.equal(bad.status, 1, bad.out);
});

test('server-release: хранятся последние 5 релизов', bashOnly, () => {
    const old = Array.from({ length: 6 }, (_, i) => `2026102${i}100000-${String(i).repeat(12)}`);
    const root = sandbox({ releases: old });
    const bin = stubBin();
    assert.equal(serverRelease(root, bin).status, 0);
    const left = readdirSync(join(root, 'releases')).sort();
    assert.equal(left.length, 5);
    assert.equal(left.at(-1), NEW);
});

test('deploy.sh rollback на сервере — предыдущий релиз за секунды, с проверкой', bashOnly, () => {
    const root = sandbox();
    const bin = stubBin();
    assert.equal(serverRelease(root, bin).status, 0);
    const started = Date.now();
    const r = bash([join(root, 'current', 'deploy', 'deploy.sh'), 'rollback'], {
        env: serverEnv(bin, root),
    });
    assert.equal(r.status, 0, r.out);
    assert.ok(Date.now() - started < 60_000, 'откат дольше минуты');
    assert.equal(current(root), RELEASES[1]);
    // Второй откат — на релиз ещё старше.
    assert.equal(
        bash([join(root, 'current', 'deploy', 'deploy.sh'), 'rollback'], {
            env: serverEnv(bin, root),
        }).status,
        0,
    );
    assert.equal(current(root), RELEASES[0]);
    const none = bash([join(root, 'current', 'deploy', 'deploy.sh'), 'rollback'], {
        env: serverEnv(bin, root),
    });
    assert.equal(none.status, 1, 'старше первого релиза откатываться некуда');
    assert.equal(current(root), RELEASES[0]);
});

// ---------- provision.sh ----------

const osRelease = (id, version) => {
    const f = join(mkdtempSync(join(tmpdir(), 'ym-os-')), 'os-release');
    writeFileSync(f, `ID=${id}\nVERSION_ID="${version}"\n`);
    return f;
};
const provisionEnv = (bin, extra = {}) => ({
    PATH: `${bin}:${process.env.PATH}`,
    STUB_LOG: join(bin, 'calls.log'),
    PROVISION_DRY_RUN: '1',
    PROVISION_OS_RELEASE: osRelease('ubuntu', '24.04'),
    APP_URL: 'https://stage.example.test',
    DEPLOY_USER: 'ymdeploy',
    DEPLOY_HOST: 'stage.example.test',
    DEPLOY_KNOWN_HOSTS: 'stage.example.test ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFakeKeyForTests',
    CERTBOT_EMAIL: 'owner@example.test',
    ...SECRETS,
    ...extra,
});

test('provision.sh apply (dry-run): все компоненты stage, без секретов в выводе', bashOnly, () => {
    const bin = stubBin();
    const r = bash(['deploy/provision.sh', 'apply'], { env: provisionEnv(bin) });
    assert.equal(r.status, 0, r.out);
    for (const step of [
        /apt-get install -yq nginx certbot supervisor redis-server postgresql-16 nodejs composer/,
        /php8\.3-fpm php8\.3-cli php8\.3-pgsql/,
        /useradd --create-home --shell \/bin\/bash ymdeploy/,
        /write \/etc\/sudoers\.d\/ymuzykant-deploy \(0440/,
        /runuser -u postgres -- psql/,
        /docker compose --env-file \/etc\/ymuzykant\/services\.env .* up -d --wait/,
        /write \/etc\/ymuzykant\/services\.env \(0600/,
        /mc: бакет ymuzykant/,
        /write \/etc\/php\/8\.3\/fpm\/pool\.d\/ymuzykant\.conf/,
        /write \/etc\/supervisor\/conf\.d\/ymuzykant\.conf/,
        /write \/etc\/nginx\/ymuzykant\/stage\.htpasswd \(0640 root:www-data\)/,
        /write \/etc\/nginx\/ymuzykant\/mailpit\.htpasswd/,
        /certbot certonly --webroot -w \/var\/www\/letsencrypt -d stage\.example\.test/,
        /write \/etc\/nginx\/sites-available\/ymuzykant/,
        /nginx -t/,
        /ufw allow 22\/tcp/,
        /ufw allow 443\/tcp/,
        /ufw --force enable/,
    ]) {
        assert.match(r.out, step);
    }
    assertNoSecrets(r.out);
    assert.equal(calls(bin), '', 'dry-run ничего не запускает');
});

test(
    'provision.sh apply: не Ubuntu LTS, root вместо пользователя деплоя, нет секретов — отказ',
    bashOnly,
    () => {
        const bin = stubBin();
        for (const [extra, reason] of [
            [{ PROVISION_OS_RELEASE: osRelease('debian', '12') }, /Ubuntu/],
            [{ PROVISION_OS_RELEASE: osRelease('ubuntu', '22.04') }, /24\.04/],
            [{ DEPLOY_USER: 'root' }, /не может быть root/],
            [
                { DB_PASSWORD: '', MAILPIT_UI_PASSWORD: '' },
                /не заданы переменные: DB_PASSWORD MAILPIT_UI_PASSWORD/,
            ],
            [{ APP_URL: 'https://bad_host!/' }, /домен/],
        ]) {
            const r = bash(['deploy/provision.sh', 'apply'], { env: provisionEnv(bin, extra) });
            assert.equal(r.status, 1, r.out);
            assert.match(r.out, reason);
            assertNoSecrets(r.out);
        }
    },
);

test('provision.sh remote: пакет по SSH с known_hosts, значения не в аргументах', bashOnly, () => {
    const bin = stubBin();
    const dry = bash(['deploy/provision.sh', 'remote'], { env: provisionEnv(bin) });
    assert.equal(dry.status, 0, dry.out);
    assert.doesNotMatch(calls(bin), /^ssh /m, 'dry-run без SSH');
    const r = bash(['deploy/provision.sh', 'remote'], {
        env: provisionEnv(bin, { PROVISION_DRY_RUN: '0' }),
    });
    assert.equal(r.status, 0, r.out);
    const ssh = calls(bin)
        .split('\n')
        .filter((l) => l.startsWith('ssh '));
    assert.equal(ssh.length, 1);
    assert.match(ssh[0], /-o StrictHostKeyChecking=yes/);
    assert.match(ssh[0], / root@stage\.example\.test /, 'provisioning — от root (PROVISION_USER)');
    assert.match(ssh[0], /provision\.sh" apply "\$d\/provision\.env"/);
    assertNoSecrets(calls(bin));
    assertNoSecrets(r.out);
    const noHosts = bash(['deploy/provision.sh', 'remote'], {
        env: provisionEnv(bin, { PROVISION_DRY_RUN: '0', DEPLOY_KNOWN_HOSTS: '' }),
    });
    assert.equal(noHosts.status, 1, noHosts.out);
});
