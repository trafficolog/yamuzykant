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
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
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
const SCRIPTS = ['deploy.sh', 'provision.sh', 'lib.sh', 'diagnose.sh', 'bin/worker.sh', 'bin/smoke-reverb.sh'];

// Секреты-метки: ни одна не должна появиться в выводе скриптов.
const SECRETS = {
    APP_KEY: 'base64:U0VDUkVULWFwcC1rZXktMDAwMS15bXV6eWthbnQtMzI=', // 32 байта: «SECRET-app-key-0001-ymuzykant-32»
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
    for (const name of ['deploy.sh', 'provision.sh', 'bin/worker.sh', 'bin/smoke-reverb.sh']) {
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

test('Nginx: stage закрыт от индексации — X-Robots-Tag везде, robots.txt без пароля', () => {
    const conf = read(DEPLOY, 'nginx', 'ymuzykant.conf');
    const tag = /add_header X-Robots-Tag "noindex, nofollow" always;/;
    // add_header в location отменяет заголовки из server — тег есть и в server, и в каждом таком location.
    assert.match(conf.slice(conf.indexOf('root __APP_ROOT__')), tag);
    for (const path of ['/build/', '/fonts/', '= /robots.txt'])
        assert.match(nginxLocation(conf, path), tag, path);
    assert.ok(conf.includes('~^/(health|up|robots\\.txt)(\\?|$) off;'), 'robots.txt без basic-auth');
    assert.ok(nginxLocation(conf, "= /robots.txt").includes(`return 200 "User-agent: *
Disallow: /
";`));
});

test('Nginx: stage за паролем, /health и /up открыты, Mailpit — свой пароль', () => {
    const conf = read(DEPLOY, 'nginx', 'ymuzykant.conf');
    assert.match(conf, /auth_basic_user_file \/etc\/nginx\/ymuzykant\/stage\.htpasswd;/);
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

// Настоящий nginx:1.24 с конфигом stage и PHP-FPM-заглушкой: /health и /up открыты (в том числе
// после внутреннего редиректа try_files → /index.php), остальное — 401 (ревью PR #96, п. 1).
const docker = (...args) => spawnSync('docker', args, { encoding: 'utf8' });
const hasDocker = () => docker('version', '--format', '{{.Server.Version}}').status === 0;
test(
    'Nginx (nginx:1.24 в Docker): /health и /up — 200 без пароля, остальное — 401',
    {
        skip: hasDocker() ? false : !process.env.CI && 'нет Docker (в CI обязателен)',
        timeout: 240_000,
    },
    () => {
        const id = `ym-ngx-${process.pid}-${Date.now()}`;
        const dir = mkdtempSync(join(tmpdir(), 'ym-ngx-'));
        const pub = join(dir, 'public');
        mkdirSync(pub);
        writeFileSync(join(pub, 'index.php'), '<?php echo "ok";\n');
        const conf = read(DEPLOY, 'nginx', 'ymuzykant.conf')
            .replaceAll('__DOMAIN__', 'stage.example.test')
            .replaceAll('__APP_ROOT__', '/var/www/ymuzykant')
            // Заглушка upstream: PHP-FPM в соседнем контейнере вместо unix-сокета.
            .replace('fastcgi_pass unix:/run/php/ymuzykant.sock;', 'fastcgi_pass php:9000;');
        assert.match(conf, /fastcgi_pass php:9000;/);
        writeFileSync(join(dir, 'site.conf'), conf);
        cpSync(join(DEPLOY, 'nginx', 'security-headers.conf'), join(dir, 'security-headers.conf'));
        const release = '/var/www/ymuzykant/releases/r1/public';
        const setup = [
            'set -e',
            'mkdir -p /etc/nginx/ymuzykant /etc/letsencrypt/live/stage.example.test',
            'cp /t/security-headers.conf /etc/nginx/ymuzykant/',
            'echo "stage:$(openssl passwd -apr1 secret)" > /etc/nginx/ymuzykant/stage.htpasswd',
            'cp /etc/nginx/ymuzykant/stage.htpasswd /etc/nginx/ymuzykant/mailpit.htpasswd',
            'openssl req -x509 -newkey rsa:2048 -nodes -subj /CN=stage.example.test -days 1 -keyout /etc/letsencrypt/live/stage.example.test/privkey.pem -out /etc/letsencrypt/live/stage.example.test/fullchain.pem 2>/dev/null',
            'ln -sfn releases/r1 /var/www/ymuzykant/current',
            'rm -f /etc/nginx/conf.d/default.conf',
            'cp /t/site.conf /etc/nginx/conf.d/ymuzykant.conf',
            'nginx -t',
            'exec nginx -g "daemon off;"',
        ].join('\n');
        try {
            assert.equal(docker('network', 'create', id).status, 0, 'docker network');
            const php = docker(
                'run',
                '-d',
                '--name',
                `${id}-php`,
                '--network',
                id,
                '--network-alias',
                'php',
                '-v',
                `${pub}:${release}:ro`,
                'php:8.3-fpm-alpine',
            );
            assert.equal(php.status, 0, php.stderr);
            const ngx = docker(
                'run',
                '-d',
                '--name',
                `${id}-ngx`,
                '--network',
                id,
                '-v',
                `${dir}:/t:ro`,
                '-v',
                `${pub}:${release}:ro`,
                'nginx:1.24',
                'bash',
                '-c',
                setup,
            );
            assert.equal(ngx.status, 0, ngx.stderr);
            const code = (path, auth = []) => {
                const r = docker(
                    'exec',
                    `${id}-ngx`,
                    'curl',
                    '-sk',
                    '-o',
                    '/dev/null',
                    '-w',
                    '%{http_code}',
                    ...auth,
                    '--resolve',
                    'stage.example.test:443:127.0.0.1',
                    `https://stage.example.test${path}`,
                );
                return r.stdout.trim();
            };
            let ready = '';
            for (let i = 0; i < 60 && !/^(200|401)$/.test(ready); i++) {
                ready = code('/health');
                if (!/^(200|401)$/.test(ready)) spawnSync('sleep', ['1']);
            }
            const logs = () => docker('logs', `${id}-ngx`).stderr;
            const expected = {
                '/health': '200',
                '/health?probe=1': '200',
                '/up': '200',
                '/': '401',
                '/healthx': '401',
                '/health/x': '401',
                '/uptime': '401',
                '/index.php': '401',
                '/build/app.js': '401',
                '/_mailpit/': '401',
            };
            for (const [path, want] of Object.entries(expected)) {
                assert.equal(code(path), want, `${path}\n${logs()}`);
            }
            assert.equal(code('/', ['-u', 'stage:secret']), '200', 'с паролем stage открыт');
            // Закрытие от индексации (0.1.12): X-Robots-Tag на всех ответах, включая 401 и статику.
            const curl = (extra, path) =>
                docker(
                    'exec',
                    `${id}-ngx`,
                    'curl',
                    '-sk',
                    ...extra,
                    '--resolve',
                    'stage.example.test:443:127.0.0.1',
                    `https://stage.example.test${path}`,
                ).stdout;
            const headers = (path, auth = []) => curl(['-D', '-', '-o', '/dev/null', ...auth], path);
            for (const path of ['/', '/health', '/build/app.js', '/fonts/x.woff2', '/robots.txt'])
                assert.match(headers(path), /^x-robots-tag: noindex, nofollow\r?$/im, path);
            assert.match(
                headers('/build/app.js', ['-u', 'stage:secret']),
                /^x-robots-tag: noindex, nofollow\r?$/im,
                '/build с паролем',
            );
            assert.equal(code('/robots.txt'), '200', 'robots.txt без пароля');
            assert.equal(curl([], '/robots.txt'), 'User-agent: *\nDisallow: /\n');
        } finally {
            docker('rm', '-f', `${id}-ngx`, `${id}-php`);
            docker('network', 'rm', id);
        }
    },
);

test('Supervisor: журналы программ — в /var/log/ymuzykant (root), не под APP_ROOT', () => {
    const conf = read(DEPLOY, 'supervisor', 'ymuzykant.conf');
    const logs = [...conf.matchAll(/^(\w+_logfile)=(.*)$/gm)];
    assert.ok(logs.length >= 4, 'у каждой программы свой журнал');
    for (const [, key, path] of logs) {
        assert.doesNotMatch(
            path,
            /__APP_ROOT__|\/var\/www/,
            `${key}=${path}: каталог пользователя деплоя`,
        );
        assert.match(path, /^\/var\/log\/ymuzykant\/[\w.-]+\.log$/, `${key}=${path}`);
    }
    assert.match(
        read(DEPLOY, 'provision.sh'),
        /install -d -m 0750 -o root -g adm \/var\/log\/ymuzykant/,
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
    const images = [...compose.matchAll(/^\s+image: (\S+)/gm)].map((m) => m[1]);
    assert.equal(images.length, 3);
    for (const image of images)
        assert.match(image, /@sha256:[0-9a-f]{64}$/, `${image}: закрепить digest`);
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

test('provision.sh не даёт пользователю деплоя полный sudo (только перезапуск своих сервисов)', () => {
    const src = read(DEPLOY, 'provision.sh');
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
// Публичный ключ из ssh-agent раннера (ssh-add -L) — его provision.sh кладёт пользователю деплоя.
const AGENT_KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAgentKeyForTests ymuzykant-deploy';
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
[[ "$*" == *"127.0.0.1:8080/up"* && \${STUB_FAIL:-} == *reverb* ]] && exit 7
if [[ "$*" == *"127.0.0.1:8080/up"* && -n \${STUB_REVERB_FAIL_FIRST:-} ]]; then
  n=$(grep -c '127.0.0.1:8080/up' "$STUB_LOG"); ((n <= STUB_REVERB_FAIL_FIRST)) && exit 7
fi
if [[ "$*" == *"/app/"* ]]; then
  printf 'HTTP/1.1 %s\\r\\n\\r\\n%s\\n' "\${STUB_WS_STATUS:-101 Switching Protocols}" "\${STUB_WS_BODY-pusher:connection_established}"
  exit 28
fi
exit 0`,
    );
    stub(
        'sudo',
        `[[ "$*" == "-n systemctl reload"* && \${STUB_FAIL:-} == *fpm* ]] && exit 1
if [[ "$*" == "-n supervisorctl status ymuzykant:*" ]]; then
  for p in queue reverb ssr scheduler; do
    s=RUNNING; [[ $p == ssr && \${STUB_FAIL:-} == *ssr* ]] && s=FATAL
    printf 'ymuzykant:ymuzykant-%s %s pid 1, uptime 0:00:05\\n' "$p" "$s"
  done
fi
exit 0`,
    );
    // STUB_SSH_FAIL_USER — вход этим пользователем не проходит (нет ключа на сервере).
    stub(
        'ssh',
        `[[ -n \${STUB_SSH_FAIL_USER:-} && "$*" == *" \${STUB_SSH_FAIL_USER}@"* ]] && { echo "Permission denied (publickey)." >&2; exit 255; }
cat > /dev/null; exit 0`,
    );
    stub(
        'ssh-add',
        `[[ "$1" == -L ]] || exit 2
[[ -n \${STUB_AGENT_KEY-x} ]] || { echo "The agent has no identities." >&2; exit 1; }
printf '%s\n' "\${STUB_AGENT_KEY-${AGENT_KEY}}"`,
    );
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
            [{ AWS_ACCESS_KEY_ID: SECRETS.MINIO_ROOT_USER }, /AWS_ACCESS_KEY_ID совпадает с MINIO_ROOT_USER/],
            [{ AWS_SECRET_ACCESS_KEY: SECRETS.MINIO_ROOT_PASSWORD }, /совпадает с MINIO_ROOT_PASSWORD/],
            [{ AWS_SECRET_ACCESS_KEY: 'short' }, /короче 8 символов/],
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
    assert.equal(ssh.length, 3, 'apply, проверка входа по ключу, sshd');
    for (const line of ssh) {
        assert.match(line, /-o StrictHostKeyChecking=yes/);
        assert.match(line, /-o PasswordAuthentication=no/);
        assert.match(line, /-o BatchMode=yes/);
    }
    assert.match(ssh[0], / root@stage\.example\.test /, 'provisioning — от root (PROVISION_USER)');
    assert.match(ssh[0], /provision\.sh" apply "\$d\/provision\.env"/);
    assertNoSecrets(calls(bin));
    assertNoSecrets(r.out);
    const sameUser = bash(['deploy/provision.sh', 'remote'], {
        env: provisionEnv(bin, { AWS_ACCESS_KEY_ID: SECRETS.MINIO_ROOT_USER }),
    });
    assert.equal(sameUser.status, 1, sameUser.out);
    assert.match(sameUser.out, /совпадает с MINIO_ROOT_USER/);
    assertNoSecrets(sameUser.out);
    const noHosts = bash(['deploy/provision.sh', 'remote'], {
        env: provisionEnv(bin, { PROVISION_DRY_RUN: '0', DEPLOY_KNOWN_HOSTS: '' }),
    });
    assert.equal(noHosts.status, 1, noHosts.out);
});

// ---------- SSH-ключ деплоя и sshd (задача 0.1.12) ----------

test('sshd: вход только по ключу — пароль и keyboard-interactive выключены, root только по ключу', () => {
    const conf = read(DEPLOY, 'ssh', '00-ymuzykant.conf');
    const lines = conf
        .split('\n')
        .map((l) => l.replace(/#.*/, '').trim())
        .filter(Boolean);
    assert.deepEqual(lines, [
        'PasswordAuthentication no',
        'KbdInteractiveAuthentication no',
        'PermitRootLogin prohibit-password',
        'PubkeyAuthentication yes',
        'PermitEmptyPasswords no',
    ]);
});

test(
    'provision.sh remote: sshd меняется только после проверки входа по ключу пользователем деплоя',
    bashOnly,
    () => {
        const bin = stubBin();
        const r = bash(['deploy/provision.sh', 'remote'], {
            env: provisionEnv(bin, { PROVISION_DRY_RUN: '0' }),
        });
        assert.equal(r.status, 0, r.out);
        const ssh = calls(bin)
            .split('\n')
            .filter((l) => l.startsWith('ssh '));
        assert.match(ssh[1], / ymdeploy@stage\.example\.test true$/, 'проверка входа по ключу');
        assert.match(ssh[2], / root@stage\.example\.test /);
        assert.match(ssh[2], /provision\.sh" sshd "\$d\/provision\.env"/);
        assert.ok(calls(bin).includes('ssh-add -L'), 'публичный ключ — из ssh-agent');
        assert.ok(!calls(bin).includes('AgentKeyForTests'), 'ключ — в пакете, не в аргументах ssh');
    },
);

test(
    'provision.sh remote: вход по ключу не прошёл — sshd не меняется, понятная ошибка',
    bashOnly,
    () => {
        const bin = stubBin();
        const r = bash(['deploy/provision.sh', 'remote'], {
            env: provisionEnv(bin, { PROVISION_DRY_RUN: '0', STUB_SSH_FAIL_USER: 'ymdeploy' }),
        });
        assert.equal(r.status, 1, r.out);
        assert.match(r.out, /вход по ключу пользователем ymdeploy не работает/);
        assert.match(r.out, /sshd не изменён/);
        assert.doesNotMatch(calls(bin), /provision\.sh" sshd/);
    },
);

test('provision.sh remote: в ssh-agent нет ключа — отказ до SSH', bashOnly, () => {
    const bin = stubBin();
    const r = bash(['deploy/provision.sh', 'remote'], {
        env: provisionEnv(bin, { PROVISION_DRY_RUN: '0', STUB_AGENT_KEY: '' }),
    });
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /DEPLOY_SSH_KEY/);
    assert.doesNotMatch(calls(bin), /^ssh /m);
});

test(
    'provision.sh apply (dry-run): публичный ключ раннера — в authorized_keys пользователя деплоя',
    bashOnly,
    () => {
        const bin = stubBin();
        const r = bash(['deploy/provision.sh', 'apply'], {
            env: provisionEnv(bin, { DEPLOY_AUTHORIZED_KEY: AGENT_KEY }),
        });
        assert.equal(r.status, 0, r.out);
        assert.match(r.out, /runuser -u ymdeploy -- .*\/home\/ymdeploy\/\.ssh\/authorized_keys/);
        const bad = bash(['deploy/provision.sh', 'apply'], {
            env: provisionEnv(bin, { DEPLOY_AUTHORIZED_KEY: 'ssh-ed25519 AAAA; rm -rf /' }),
        });
        assert.equal(bad.status, 1, bad.out);
        assert.match(bad.out, /DEPLOY_AUTHORIZED_KEY/);
    },
);

// Песочница для проверок authorized_keys: PROVISION_FS_ROOT подменяет корень (/root, /home).
const keysRoot = ({ root = true, deploy = true } = {}) => {
    const fs = mkdtempSync(join(tmpdir(), 'ym-fs-'));
    for (const [dir, ok] of [
        ['root', root],
        ['home/ymdeploy', deploy],
    ]) {
        mkdirSync(join(fs, dir, '.ssh'), { recursive: true });
        if (ok) writeFileSync(join(fs, dir, '.ssh', 'authorized_keys'), `${AGENT_KEY}\n`);
    }
    return fs;
};

test(
    'provision.sh sshd (dry-run): конфиг в sshd_config.d, sshd -t, сверка sshd -T, перезагрузка',
    bashOnly,
    () => {
        const bin = stubBin();
        const r = bash(['deploy/provision.sh', 'sshd'], {
            env: provisionEnv(bin, { PROVISION_FS_ROOT: keysRoot() }),
        });
        assert.equal(r.status, 0, r.out);
        for (const step of [
            /write \/etc\/ssh\/sshd_config\.d\/00-ymuzykant\.conf \(0644/,
            /\+ sshd -t/,
            /\+ sshd -T/,
            /\+ systemctl reload-or-restart ssh/,
        ]) {
            assert.match(r.out, step);
        }
        assertNoSecrets(r.out);
        assert.equal(calls(bin), '', 'dry-run ничего не запускает');
    },
);

for (const [label, opts, who] of [
    ['у root', { root: false }, /root/],
    ['у пользователя деплоя', { deploy: false }, /ymdeploy/],
]) {
    test(`provision.sh sshd: нет ключа ${label} — sshd не меняется`, bashOnly, () => {
        const bin = stubBin();
        const r = bash(['deploy/provision.sh', 'sshd'], {
            env: provisionEnv(bin, { PROVISION_FS_ROOT: keysRoot(opts) }),
        });
        assert.equal(r.status, 1, r.out);
        assert.match(r.out, /нет ключа в authorized_keys/);
        assert.match(r.out, who);
        assert.match(r.out, /sshd не изменён/);
        assert.doesNotMatch(r.out, /sshd_config\.d/);
    });
}

test('deploy.sh: ожидание блокировки на сервере — из DEPLOY_LOCK_WAIT раннера', bashOnly, () => {
    const { dir, sha } = fakeRepo();
    const bin = stubBin();
    const r = bash(['deploy/deploy.sh', 'stage', sha], {
        cwd: dir,
        env: runnerEnv(bin, { DEPLOY_LOCK_WAIT: '600' }),
    });
    assert.equal(r.status, 0, r.out);
    assert.match(
        calls(bin),
        /^ssh .* DEPLOY_LOCK_WAIT=600 bash \S+\/deploy\/deploy\.sh server-release /m,
    );
    const rb = bash(['deploy/deploy.sh', 'rollback', 'stage'], {
        cwd: dir,
        env: runnerEnv(bin, { DEPLOY_LOCK_WAIT: '600' }),
    });
    assert.equal(rb.status, 0, rb.out);
    assert.match(calls(bin), /^ssh .* DEPLOY_LOCK_WAIT=600 bash \S+\/deploy\.sh rollback$/m);
    const bad = bash(['deploy/deploy.sh', 'stage', sha], {
        cwd: dir,
        env: runnerEnv(bin, { DEPLOY_LOCK_WAIT: '9; id' }),
    });
    assert.equal(bad.status, 1, bad.out);
    assert.match(bad.out, /DEPLOY_LOCK_WAIT/);
});

// ---------- ревью PR #96, круг 1 ----------

// Ещё один распакованный релиз в песочнице.
const addRelease = (root, id) => {
    cpSync(DEPLOY, join(root, 'releases', id, 'deploy'), { recursive: true });
    mkdirSync(join(root, 'releases', id, 'storage'), { recursive: true });
};
const releaseRun = (root, bin, id, extra) =>
    bash([join(root, 'releases', id, 'deploy', 'deploy.sh'), 'server-release', id], {
        cwd: root,
        env: serverEnv(bin, root, extra),
    });

test('server-release: падение перезапуска после переключения — автооткат (п. 4)', bashOnly, () => {
    const root = sandbox();
    const bin = stubBin();
    const r = serverRelease(root, bin, { STUB_FAIL: 'fpm' });
    assert.equal(r.status, 1, r.out);
    assert.equal(current(root), RELEASES[1], 'current вернулся на прежний релиз');
    assert.match(r.out, /перезапуск .* не прошёл|не прошла — откат/);
});

test(
    'релиз с автооткатом помечен, не входит в 5 хранимых и пропускается откатом (п. 5)',
    bashOnly,
    () => {
        const old = Array.from(
            { length: 5 },
            (_, i) => `2026102${i}100000-${String(i).repeat(12)}`,
        );
        const root = sandbox({ releases: old });
        const bin = stubBin();
        assert.equal(serverRelease(root, bin, { STUB_FAIL: 'health' }).status, 1);
        assert.equal(current(root), old.at(-1));
        assert.ok(
            existsSync(join(root, 'releases', NEW, '.deploy-failed')),
            'нет пометки .deploy-failed',
        );
        // Ручной откат не уходит на неудачный релиз (он новее current, но и старше не выбирается).
        const next = '20261104100000-dddddddddddd';
        addRelease(root, next);
        assert.equal(releaseRun(root, bin, next).status, 0);
        assert.equal(current(root), next);
        const left = readdirSync(join(root, 'releases')).sort();
        assert.ok(!left.includes(NEW), 'неудачный релиз удаляется первым');
        assert.equal(left.length, 5, left.join(' '));
        assert.deepEqual(left, [...old.slice(1), next], 'хранятся 5 рабочих релизов');
        const r = bash([join(root, 'current', 'deploy', 'deploy.sh'), 'rollback'], {
            env: serverEnv(bin, root),
        });
        assert.equal(r.status, 0, r.out);
        assert.equal(current(root), old.at(-1));
    },
);

test('rollback пропускает помеченный неудачный релиз', bashOnly, () => {
    const root = sandbox();
    const bin = stubBin();
    writeFileSync(join(root, 'releases', NEW, '.deploy-failed'), '');
    const next = '20261104100000-ffffffffffff';
    addRelease(root, next);
    symlinkSync(`releases/${next}`, join(root, 'current.tmp'));
    spawnSync('mv', ['-Tf', join(root, 'current.tmp'), join(root, 'current')]);
    assert.equal(current(root), next);
    const r = bash([join(root, 'current', 'deploy', 'deploy.sh'), 'rollback'], {
        env: serverEnv(bin, root),
    });
    assert.equal(r.status, 0, r.out);
    assert.equal(current(root), RELEASES[1], 'откат мимо неудачного релиза');
});

test(
    'выкатка ждёт идущий откат (flock с ожиданием), а не падает сразу (п. 8)',
    bashOnly,
    async () => {
        const root = sandbox();
        const bin = stubBin();
        const { spawn } = await import('node:child_process');
        const holder = spawn('flock', [join(root, '.deploy.lock'), 'sleep', '3']);
        await delay(300);
        const started = Date.now();
        const r = serverRelease(root, bin, { DEPLOY_LOCK_WAIT: '20' });
        assert.equal(r.status, 0, r.out);
        assert.ok(Date.now() - started >= 2000, 'выкатка дождалась освобождения блокировки');
        holder.kill();
        const busy = spawn('flock', [join(root, '.deploy.lock'), 'sleep', '5']);
        await delay(300);
        const r2 = bash([join(root, 'current', 'deploy', 'deploy.sh'), 'rollback'], {
            env: serverEnv(bin, root, { DEPLOY_LOCK_WAIT: '1' }),
        });
        busy.kill();
        assert.equal(r2.status, 1, r2.out);
        assert.match(r2.out, /блокировк|другая выкатка/);
    },
);

test('deploy.sh: DEPLOY_USER и DEPLOY_HOST проверяются до ssh (п. 9)', bashOnly, () => {
    const { dir, sha } = fakeRepo();
    const bin = stubBin();
    for (const extra of [
        { DEPLOY_USER: 'Root' },
        { DEPLOY_USER: '-oProxyCommand=x' },
        { DEPLOY_USER: 'a b' },
        { DEPLOY_HOST: '-oProxyCommand=touch /tmp/x' },
        { DEPLOY_HOST: 'host name' },
        { DEPLOY_HOST: 'user@host' },
    ]) {
        const r = bash(['deploy/deploy.sh', 'stage', sha], {
            cwd: dir,
            env: runnerEnv(bin, extra),
        });
        assert.equal(r.status, 1, `${JSON.stringify(extra)}: ${r.out}`);
        const rb = bash(['deploy/deploy.sh', 'rollback', 'stage'], {
            cwd: dir,
            env: runnerEnv(bin, extra),
        });
        assert.equal(rb.status, 1, `rollback ${JSON.stringify(extra)}`);
    }
    assert.doesNotMatch(calls(bin), /^ssh /m, 'ssh не вызывался');
    for (const host of ['203.0.113.10', 'stage.example.test', '2001:db8::1']) {
        const r = bash(['deploy/deploy.sh', 'stage', sha], {
            cwd: dir,
            env: runnerEnv(bin, { DEPLOY_HOST: host }),
        });
        assert.equal(r.status, 0, `${host}: ${r.out}`);
    }
});

test(
    'provision.sh remote: PROVISION_USER и DEPLOY_HOST проверяются до ssh (п. 9)',
    bashOnly,
    () => {
        const bin = stubBin();
        for (const extra of [{ PROVISION_USER: '-oProxyCommand=x' }, { DEPLOY_HOST: '-x' }]) {
            const r = bash(['deploy/provision.sh', 'remote'], {
                env: provisionEnv(bin, { PROVISION_DRY_RUN: '0', ...extra }),
            });
            assert.equal(r.status, 1, r.out);
        }
        assert.doesNotMatch(calls(bin), /^ssh /m);
    },
);

test(
    'provision.sh: каталоги пользователя деплоя создаются от его имени, симлинки не обходятся (п. 3)',
    bashOnly,
    () => {
        const bin = stubBin();
        const r = bash(['deploy/provision.sh', 'apply'], { env: provisionEnv(bin) });
        assert.equal(r.status, 0, r.out);
        const lines = r.out.split('\n').filter((l) => /^\+ .*install -d/.test(l));
        for (const line of lines) {
            if (/-o ymdeploy/.test(line))
                assert.match(
                    line,
                    /^\+ install -d -m 0755 -o ymdeploy -g ymdeploy \/var\/www\/ymuzykant$/,
                    line,
                );
        }
        for (const path of [
            '/var/www/ymuzykant/releases',
            '/var/www/ymuzykant/shared/storage/logs',
            '/home/ymdeploy/.ssh',
        ]) {
            assert.ok(
                lines.some(
                    (l) => l.startsWith('+ runuser -u ymdeploy -- install -d ') && l.endsWith(path),
                ),
                `${path} — через runuser от пользователя деплоя`,
            );
        }
        assert.match(r.out, /\+ install -d -m 0750 -o root -g adm \/var\/log\/ymuzykant/);
        // APP_ROOT — симлинк: отказ.
        const dir = mkdtempSync(join(tmpdir(), 'ym-link-'));
        symlinkSync('/etc', join(dir, 'app'));
        const link = bash(['deploy/provision.sh', 'apply'], {
            env: provisionEnv(bin, { DEPLOY_APP_ROOT: join(dir, 'app') }),
        });
        assert.equal(link.status, 1, link.out);
        assert.match(link.out, /симлинк/);
    },
);

test('deploy.sh: комментарий, почему .env пишется до сборки (п. 6)', () => {
    const src = read(DEPLOY, 'deploy.sh');
    assert.match(src, /config:cache/);
    assert.match(
        src,
        /# .*shared\/\.env[\s\S]{0,400}config:cache/,
        'обоснование рядом с записью .env',
    );
});

// ---------- Reverb на stage и production (задача 0.1.16) ----------

// deploy.sh можно подключить через source: main запускается, только когда файл выполняют напрямую.
const renderEnv = (env, overrides = {}) => {
    const vars = Object.fromEntries(
        Object.entries({ APP_URL: 'https://stage.example.test', ...SECRETS, ...overrides }).filter(
            ([, v]) => v !== null,
        ),
    );
    return bash(['-c', 'source deploy/deploy.sh; render_env "$1"', '_', env], { env: vars });
};
const envValue = (dotenv, key) => dotenv.match(new RegExp(`^${key}=['"](.*)['"]$`, 'm'))?.[1];

test('.env stage и production: APP_NOINDEX=true только на stage', bashOnly, () => {
    assert.equal(envValue(renderEnv('stage').stdout, 'APP_NOINDEX'), 'true');
    assert.doesNotMatch(renderEnv('production').stdout, /^APP_NOINDEX=/m);
});

test('.env с секретами Reverb: вещание reverb, браузер на wss://домен:443, origin — домен', bashOnly, () => {
    const r = renderEnv('stage');
    assert.equal(r.status, 0, r.out);
    const env = r.stdout;
    assert.equal(envValue(env, 'BROADCAST_CONNECTION'), 'reverb');
    assert.equal(envValue(env, 'REVERB_HOST'), '127.0.0.1', 'приложение шлёт события локально');
    assert.equal(envValue(env, 'REVERB_PORT'), '8080');
    assert.equal(envValue(env, 'REVERB_SCHEME'), 'http');
    assert.equal(envValue(env, 'REVERB_SERVER_HOST'), '127.0.0.1');
    assert.equal(envValue(env, 'REVERB_SERVER_PORT'), '8080');
    assert.equal(envValue(env, 'REVERB_PUBLIC_HOST'), 'stage.example.test');
    assert.equal(envValue(env, 'REVERB_PUBLIC_PORT'), '443');
    assert.equal(envValue(env, 'REVERB_PUBLIC_SCHEME'), 'https');
    assert.equal(envValue(env, 'REVERB_ALLOWED_ORIGINS'), 'stage.example.test');
    assert.equal(envValue(env, 'REVERB_APP_KEY'), SECRETS.REVERB_APP_KEY);
    assert.doesNotMatch(env, /^VITE_REVERB/m, 'фронт читает shared prop realtime, а не VITE_*');
});

test('.env без секрета Reverb: вещание null (не log: текст сообщений не в журнал), REVERB_* нет', bashOnly, () => {
    const r = renderEnv('production', { REVERB_APP_SECRET: null });
    assert.equal(r.status, 0, r.out);
    assert.equal(envValue(r.stdout, 'BROADCAST_CONNECTION'), 'null');
    assert.doesNotMatch(r.stdout, /^REVERB_/m);
});

test('.env: секрет Reverb есть, а ключа нет — отказ без печати значений', bashOnly, () => {
    const r = renderEnv('stage', { REVERB_APP_KEY: null });
    assert.equal(r.status, 1);
    assert.match(r.out, /REVERB_APP_KEY/);
    // stdout — недописанный .env (в песочнице теста), в сообщении об ошибке секретов нет.
    assertNoSecrets(r.out.replace(r.stdout, ''));
});

test('Nginx: /app/ — wss через Upgrade, длинные таймауты, без буферизации, только на 127.0.0.1:8080', () => {
    const conf = read(DEPLOY, 'nginx', 'ymuzykant.conf');
    const app = nginxLocation(conf, '/app/');
    assert.match(app, /proxy_http_version 1\.1;/);
    assert.match(app, /proxy_set_header Upgrade \$http_upgrade;/);
    assert.match(app, /proxy_set_header Connection \$connection_upgrade;/);
    assert.match(app, /proxy_set_header Host \$host;/);
    assert.match(app, /proxy_set_header X-Forwarded-Proto \$scheme;/);
    assert.match(app, /proxy_buffering off;/);
    // Reverb шлёт ping раз в 60 с (REVERB_APP_PING_INTERVAL): таймауты строго больше.
    for (const d of ['proxy_read_timeout', 'proxy_send_timeout']) {
        const sec = Number(app.match(new RegExp(`${d} (\\d+)s;`))?.[1]);
        assert.ok(sec >= 120, `${d} ≥ 120 с`);
    }
    assert.match(app, /proxy_pass http:\/\/127\.0\.0\.1:8080;/);
    assert.doesNotMatch(conf, /location \/apps\//, 'HTTP API Reverb наружу не отдаём');
    assert.match(conf, /map \$http_upgrade \$connection_upgrade/);
});

test('worker.sh reverb: поднимает лимит открытых файлов до запуска reverb:start', () => {
    const worker = read(DEPLOY, 'bin', 'worker.sh');
    const block = worker.split('\nreverb)')[1]?.split(';;')[0] ?? '';
    assert.match(block, /ulimit -n /);
    assert.ok(block.indexOf('ulimit -n') < block.indexOf('reverb:start'), 'ulimit раньше запуска');
});

const withEnvFile = (root, text) => writeFileSync(join(root, 'shared', '.env'), text);
const ENV_REVERB = "APP_URL='https://stage.example.test'\nBROADCAST_CONNECTION='reverb'\n";

test('server-release: вещание reverb — проверяется, что Reverb слушает 127.0.0.1:8080', bashOnly, () => {
    const root = sandbox();
    withEnvFile(root, ENV_REVERB);
    const bin = stubBin();
    const r = serverRelease(root, bin);
    assert.equal(r.status, 0, r.out);
    assert.match(calls(bin), /curl -sS --max-time 5 -o \/dev\/null http:\/\/127\.0\.0\.1:8080\/up/);
});

test('server-release: вещание reverb, а Reverb не отвечает — автооткат', bashOnly, () => {
    const root = sandbox();
    withEnvFile(root, ENV_REVERB);
    const bin = stubBin();
    const r = serverRelease(root, bin, { STUB_FAIL: 'reverb' });
    assert.notEqual(r.status, 0, r.out);
    assert.match(r.out, /Reverb не отвечает/);
    assert.equal(current(root), RELEASES.at(-1), 'откат на прежний релиз');
});

test('server-release: Reverb стартует медленно (ответил со второй попытки) — отката нет', bashOnly, () => {
    const root = sandbox();
    withEnvFile(root, ENV_REVERB);
    const bin = stubBin();
    const r = serverRelease(root, bin, { STUB_REVERB_FAIL_FIRST: '1' });
    assert.equal(r.status, 0, r.out);
    assert.equal(current(root), NEW, 'релиз остался');
    assert.equal(calls(bin).match(/127\.0\.0\.1:8080\/up/g).length, 2);
});

test('server-release: вещание не reverb — Reverb не проверяется и не блокирует выкатку', bashOnly, () => {
    const root = sandbox();
    withEnvFile(root, "APP_URL='https://stage.example.test'\nBROADCAST_CONNECTION='null'\n");
    const bin = stubBin();
    const r = serverRelease(root, bin, { STUB_FAIL: 'reverb' });
    assert.equal(r.status, 0, r.out);
    assert.doesNotMatch(calls(bin), /127\.0\.0\.1:8080/);
});

const smoke = (args, bin, extra = {}) =>
    bash(['deploy/bin/smoke-reverb.sh', ...args], {
        env: { PATH: `${bin}:${process.env.PATH}`, STUB_LOG: join(bin, 'calls.log'), ...extra },
    });

test('smoke-reverb.sh: рукопожатие wss даёт 101 и pusher:connection_established — успех', bashOnly, () => {
    const bin = stubBin();
    const r = smoke(['stage.example.test', 'reverb-public-key'], bin);
    assert.equal(r.status, 0, r.out);
    const log = calls(bin);
    assert.match(log, /https:\/\/stage\.example\.test\/app\/reverb-public-key\?protocol=7/);
    assert.match(log, /Upgrade: websocket/);
    assert.match(log, /Origin: https:\/\/stage\.example\.test/);
});

test('smoke-reverb.sh: не 101 или нет connection_established — отказ; без аргументов — 2', bashOnly, () => {
    const bin = stubBin();
    assert.equal(
        smoke(['stage.example.test', 'k'], bin, { STUB_WS_STATUS: '502 Bad Gateway' }).status,
        1,
    );
    assert.equal(smoke(['stage.example.test', 'k'], bin, { STUB_WS_BODY: '{}' }).status, 1);
    assert.equal(smoke([], bin).status, 2);
    assert.equal(smoke(['bad host;', 'k'], bin).status, 2, 'домен проверяется');
});

test('smoke-reverb.sh: пароль stage — через stdin curl, не в аргументах', bashOnly, () => {
    const bin = stubBin();
    const r = smoke(['stage.example.test', 'k'], bin, {
        SMOKE_BASIC_AUTH: 'stage:SECRET-basic-0007',
    });
    assert.equal(r.status, 0, r.out);
    assert.ok(!calls(bin).includes('SECRET-basic-0007'), 'пароль в argv');
    assertNoSecrets(r.out);
});

test('документы: переменные Reverb, чек-лист G1 и дымовой скрипт описаны', () => {
    const arch = read(ROOT, 'docs', '01-architecture', 'ARCHITECTURE.md');
    const cicd = read(ROOT, 'docs', '02-process', 'CI-CD.md');
    const g1 = read(ROOT, 'docs', 'operations', 'gates', 'G1.md');
    for (const name of ['REVERB_PUBLIC_HOST', 'REVERB_ALLOWED_ORIGINS', 'REVERB_APP_PING_INTERVAL']) {
        assert.ok(arch.includes(name), `ARCHITECTURE §9: ${name}`);
    }
    for (const name of ['REVERB_APP_SECRET', 'BROADCAST_CONNECTION', 'smoke-reverb.sh', 'wss']) {
        assert.ok(cicd.includes(name), `CI-CD: ${name}`);
    }
    assert.match(g1, /smoke-reverb\.sh/);
    assert.match(g1, /0\.1\.12/);
    const example = read(ROOT, '.env.example');
    for (const name of ['REVERB_PUBLIC_HOST', 'REVERB_ALLOWED_ORIGINS']) {
        assert.ok(example.includes(name), `.env.example: ${name}`);
    }
});

// 0.1.12: provision упал на stage — встроенный python3 -c не компилировался (\" внутри одинарных кавычек bash).
const hasPython = () => spawnSync('python3', ['--version']).status === 0;
test(
    'встроенные python3 -c в deploy/ компилируются',
    { skip: hasPython() ? false : !process.env.CI && 'нет python3 (в CI обязателен)' },
    () => {
        const snippets = SCRIPTS.flatMap((s) =>
            [...read(DEPLOY, s).matchAll(/python3 -c '([^']*)'/g)].map((m) => [s, m[1]]),
        );
        assert.ok(snippets.length > 0, 'ожидался хотя бы один python3 -c');
        for (const [file, code] of snippets) {
            const r = spawnSync('python3', ['-c', 'import sys; compile(sys.argv[1], "<inline>", "exec")', code], {
                encoding: 'utf8',
            });
            assert.equal(r.status, 0, `${file}: ${r.stderr}`);
        }
    },
);

test('provision.sh: адрес MinIO для mc — логин и пароль в URL-кодировке', bashOnly, () => {
    const line = read(DEPLOY, 'provision.sh').match(/mc_host=\$\((.*)\)$/m)[1];
    const r = spawnSync('bash', ['-c', `MINIO_ROOT_USER='u@x' MINIO_ROOT_PASSWORD='p:/w#' ; printf %s "$(${line})"`], {
        encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, 'http://u%40x:p%3A%2Fw%23@127.0.0.1:9000');
});

// 0.1.12: на stage Ubuntu 24.04 ставит nginx 1.24 — директивы `http2 on;` там нет (появилась в 1.25.1).
test('Nginx: конфиг совместим с nginx 1.24 (Ubuntu 24.04) — http2 в listen, без «http2 on;»', () => {
    const conf = read(DEPLOY, 'nginx', 'ymuzykant.conf');
    assert.doesNotMatch(conf, /^\s*http2\s+on\s*;/m);
    assert.match(conf, /listen 443 ssl http2;/);
});

// 0.1.12: диагностика stage печатает в публичный журнал Actions — только безопасное, ничего не меняет.
test('diagnose.sh: на сервере только чтение, без текста ошибок и .env', () => {
    // Всё, что уходит на сервер: error_summary и тексты heredoc REMOTE (main с rm -rf $tmp — на раннере).
    const src = read(DEPLOY, 'diagnose.sh');
    const remote = src.slice(0, src.indexOf('\nmain() {'));
    assert.match(remote, /error_summary/);
    assert.match(remote, /cut -c1-300/);
    const forbidden = [/\bsed -i\b/, /\brm\b/, /\bmv\b/, /\bchmod\b/, /\bchown\b/, /\btee\b/, /systemctl (restart|reload|stop|start)/];
    for (const re of [...forbidden, /supervisorctl (restart|stop|start)/]) {
        assert.doesNotMatch(remote, re, `на сервере не должно быть ${re}`);
    }
    assert.doesNotMatch(remote, /cat [^\n]*\.env/, 'не печатать .env');
    const wf = read(WORKFLOWS, 'provision.yml');
    assert.match(wf, /options: \[provision, rollback, diagnose\]/);
    const step = wf.slice(wf.indexOf('./deploy/diagnose.sh'));
    assert.doesNotMatch(step, /PASSWORD|SECRET|APP_KEY/, 'диагностике не нужны пароли');
});

test('diagnose.sh: по ошибке Laravel — только время, уровень, класс, код и file:line', bashOnly, () => {
    const lines = [
        '[2026-11-17 19:40:01] production.ERROR: SQLSTATE[23505]: insert into users (email) values (anna@example.ru) {"userId":7,"exception":"[object] (Illuminate\\Database\\QueryException(code: 23505): SQLSTATE anna@example.ru at /var/www/ymuzykant/releases/r1/vendor/laravel/framework/src/Illuminate/Database/Connection.php:825)"}',
        '[2026-11-17 19:41:00] production.ERROR: GET https://api.telegram.org/bot123:SECRETTOKEN/x?api_key=K1 {"userId":5}',
        '[2026-11-17 19:42:00] production.CRITICAL: AccessKeyId AKIAABCDEFGHIJKLMNOP {"exception":"[object] (Aws\\S3\\Exception\\S3Exception(code: 0): StringToSign AKIAABCDEFGHIJKLMNOP at /var/www/ymuzykant/releases/r1/vendor/aws/aws-sdk-php/src/WrappedHttpHandler.php:196)"}',
    ];
    const r = spawnSync('bash', ['-c', `source ${JSON.stringify(join(DEPLOY, 'diagnose.sh'))}; error_summary`], {
        input: lines.join('\n') + '\n',
        encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr);
    const out = r.stdout.trim().split('\n');
    assert.equal(out.length, 3);
    assert.match(out[0], /^2026-11-17 19:40:01 ERROR Illuminate\\{1,2}Database\\{1,2}QueryException code=23505 \/var\/www\/.*Connection\.php:825$/);
    assert.equal(out[1], '2026-11-17 19:41:00 ERROR (без исключения)');
    assert.match(out[2], /S3Exception code=0 .*WrappedHttpHandler\.php:196$/);
    for (const secret of ['anna@example.ru', 'SECRETTOKEN', 'api_key', 'AKIA', 'userId', 'insert into']) {
        assert.ok(!r.stdout.includes(secret), `в вывод попало «${secret}»`);
    }
});

// 0.1.12: на stage APP_KEY оказался неверной длины — Laravel падал на каждой странице (Encrypter:61).
test('deploy.sh: APP_KEY — base64: и 32 байта, иначе отказ без печати значения', bashOnly, () => {
    const check = (key) =>
        spawnSync('bash', ['-c', `source ${JSON.stringify(join(DEPLOY, 'deploy.sh'))}; check_app_key "$1"`, '_', key], {
            encoding: 'utf8',
        });
    assert.equal(check('base64:' + Buffer.alloc(32, 7).toString('base64')).status, 0);
    for (const bad of ['base64:' + Buffer.alloc(16, 7).toString('base64'), Buffer.alloc(32, 7).toString('base64'), 'secret-value-123', 'base64:###']) {
        const r = check(bad);
        assert.notEqual(r.status, 0, `ключ должен быть отклонён: ${bad.length} символов`);
        assert.ok(!(r.stdout + r.stderr).includes(bad), 'значение ключа не печатается');
        assert.match(r.stderr, /APP_KEY/);
    }
});
