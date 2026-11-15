#!/usr/bin/env bash
# Подготовка сервера stage (задача 0.1.4): чистый VPS Ubuntu LTS, без прокси и CDN.
# Идемпотентно: повторный запуск приводит сервер к тому же состоянию и ничего не ломает.
#
#   deploy/provision.sh remote          с раннера (provision.yml): упаковать deploy/ и значения,
#                                       передать по SSH (stdin), выполнить `apply` от root, проверить
#                                       вход по ключу пользователем деплоя и только тогда `sshd`
#   deploy/provision.sh apply [ENV]     на сервере от root; ENV — файл со значениями (удаляется после)
#   deploy/provision.sh sshd [ENV]      на сервере от root: вход только по ключу (задача 0.1.12)
#   PROVISION_DRY_RUN=1                 показать план без изменений (и без SSH в режиме remote)
#
# Ставит: Nginx (HTTPS через certbot, Cache-Control для /build и /fonts, basic-auth stage),
# PHP 8.3-FPM, PostgreSQL 16, Redis 7, Node 22, Composer, Supervisor (очередь high,default — Horizon,
# Reverb, SSR, планировщик), в Docker на 127.0.0.1 — Meilisearch, Mailpit (за паролем), MinIO;
# пользователь деплоя без root (ключ — публичная часть DEPLOY_SSH_KEY) с sudo только на перезапуск
# своих процессов; firewall (22, 80, 443); sshd без входа по паролю (deploy/ssh/00-ymuzykant.conf).
set -Eeuo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=deploy/lib.sh
source "$HERE/lib.sh"

APP_ROOT=${DEPLOY_APP_ROOT:-$YM_DEFAULT_APP_ROOT}
DRY_RUN=${PROVISION_DRY_RUN:-0}
PHP_VERSION=8.3
PG_VERSION=16
NODE_MAJOR=22
CONF_DIR=/etc/ymuzykant

# Значения, которые раннер передаёт на сервер (секреты окружения stage и переменные).
PROVISION_VARS=(
    APP_URL DEPLOY_USER DEPLOY_PORT DEPLOY_AUTHORIZED_KEY CERTBOT_EMAIL
    DB_PASSWORD MEILISEARCH_KEY
    MINIO_ROOT_USER MINIO_ROOT_PASSWORD AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_BUCKET
    STAGE_BASIC_AUTH_USER STAGE_BASIC_AUTH_PASSWORD MAILPIT_UI_USER MAILPIT_UI_PASSWORD
)
REQUIRED_VARS=(
    APP_URL DEPLOY_USER CERTBOT_EMAIL
    DB_PASSWORD MEILISEARCH_KEY
    MINIO_ROOT_USER MINIO_ROOT_PASSWORD AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
    STAGE_BASIC_AUTH_USER STAGE_BASIC_AUTH_PASSWORD MAILPIT_UI_USER MAILPIT_UI_PASSWORD
)

# ---------- раннер ----------

provision_remote() {
    require_vars "${REQUIRED_VARS[@]}"
    local tmp name user=${PROVISION_USER:-root}
    tmp=$(mktemp -d)
    # shellcheck disable=SC2064
    trap "rm -rf '$tmp'" EXIT
    if [[ $DRY_RUN != 1 ]]; then
        # Публичная часть DEPLOY_SSH_KEY из ssh-agent раннера: её получает пользователь деплоя.
        DEPLOY_AUTHORIZED_KEY=$(ssh-add -L 2>/dev/null | head -n 1) || true
        valid_pubkey "${DEPLOY_AUTHORIZED_KEY:-}" ||
            die "в ssh-agent нет ключа: проверьте секрет DEPLOY_SSH_KEY и шаг webfactory/ssh-agent"
    fi
    (
        umask 077
        for name in "${PROVISION_VARS[@]}"; do
            printf '%s=%q\n' "$name" "${!name:-}"
        done >"$tmp/provision.env"
    )
    tar -czf "$tmp/bundle.tar.gz" -C "$HERE/.." deploy -C "$tmp" provision.env
    if [[ $DRY_RUN == 1 ]]; then
        log "DRY-RUN: пакет $(wc -c <"$tmp/bundle.tar.gz") байт, значения: ${PROVISION_VARS[*]}"
        log "DRY-RUN: на сервер ничего не отправлено: ssh ${user}@<DEPLOY_HOST> provision.sh apply,"
        log "DRY-RUN: ssh ${DEPLOY_USER}@<DEPLOY_HOST> true (вход по ключу), ssh ${user}@<DEPLOY_HOST> provision.sh sshd"
        return 0
    fi
    require_vars DEPLOY_HOST
    # shellcheck disable=SC2153 # DEPLOY_HOST проверен require_vars
    check_ssh_target "$user" "$DEPLOY_HOST"
    check_ssh_target "$DEPLOY_USER" "$DEPLOY_HOST"
    ssh_setup "$tmp"
    remote_provision "$user" apply "$tmp/bundle.tar.gz"
    # sshd меняется, только если пользователь деплоя уже входит по ключу (BatchMode, без пароля):
    # иначе после отключения пароля на сервер было бы не попасть.
    log "Проверка входа по ключу пользователем ${DEPLOY_USER}"
    # shellcheck disable=SC2153 # DEPLOY_HOST проверен require_vars
    if ! ssh "${SSH_OPTS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" true </dev/null; then
        die "вход по ключу пользователем ${DEPLOY_USER} не работает — sshd не изменён, вход по паролю оставлен"
    fi
    log "Вход на сервер только по ключу (sshd)"
    remote_provision "$user" sshd "$tmp/bundle.tar.gz"
}

# Выполнить provision.sh <apply|sshd> на сервере. Пакет — во временном каталоге 0700, удаляется
# в любом случае.
remote_provision() {
    local user=$1 command=$2 bundle=$3
    [[ $command == apply || $command == sshd ]] || die "remote_provision: неизвестная команда"
    # shellcheck disable=SC2153 # DEPLOY_HOST проверен require_vars
    ssh "${SSH_OPTS[@]}" "${user}@${DEPLOY_HOST}" \
        'set -e; d=$(mktemp -d); trap "rm -rf \"$d\"" EXIT; tar -xzf - -C "$d"; bash "$d/deploy/provision.sh" '"$command"' "$d/provision.env"' \
        <"$bundle"
}

# ---------- сервер: примитивы с dry-run ----------

run() {
    if [[ $DRY_RUN == 1 ]]; then
        printf '+ %s\n' "$*"
    else
        "$@"
    fi
}

# Проверка состояния сервера. В dry-run — «нет» (план для чистого сервера).
query() {
    [[ $DRY_RUN == 1 ]] && return 1
    "$@" >/dev/null 2>&1
}

CHANGED=()
# Записывает stdin в файл, если содержимое изменилось. put_file PATH MODE [OWNER]
put_file() {
    local path=$1 mode=$2 owner=${3:-root:root} tmp
    if [[ $DRY_RUN == 1 ]]; then
        cat >/dev/null
        printf '+ write %s (%s %s)\n' "$path" "$mode" "$owner"
        return 0
    fi
    tmp=$(mktemp)
    cat >"$tmp"
    if [[ -f $path ]] && cmp -s "$tmp" "$path"; then
        rm -f "$tmp"
    else
        install -D -m "$mode" -o "${owner%%:*}" -g "${owner##*:}" "$tmp" "$path"
        rm -f "$tmp"
        CHANGED+=("$path")
        log "записан ${path}"
    fi
}

changed() {
    local p
    for p in "${CHANGED[@]}"; do [[ $p == "$1"* ]] && return 0; done
    return 1
}

template() {
    sed -e "s|__DOMAIN__|${DOMAIN}|g" -e "s|__APP_ROOT__|${APP_ROOT}|g" -e "s|__USER__|${DEPLOY_USER}|g" "$HERE/$1"
}

# Строка htpasswd (apr1). Пароль идёт в openssl через stdin, не в argv.
htpasswd_line() {
    local user=$1 pass=$2
    [[ $user =~ ^[A-Za-z0-9._-]+$ ]] || die "имя пользователя basic-auth: только латиница, цифры, . _ -"
    if [[ $DRY_RUN == 1 ]]; then
        printf '%s:<hash>\n' "$user"
        return 0
    fi
    printf '%s:%s\n' "$user" "$(printf '%s' "$pass" | openssl passwd -apr1 -stdin)"
}

# ---------- сервер: шаги ----------

check_os() {
    [[ $DRY_RUN == 1 ]] || [[ $EUID -eq 0 ]] || die "provision.sh apply запускается от root"
    local os_release=${PROVISION_OS_RELEASE:-/etc/os-release} id version
    [[ -r $os_release ]] || die "нет ${os_release}"
    # shellcheck disable=SC1090
    id=$(. "$os_release" && printf '%s' "${ID:-}")
    # shellcheck disable=SC1090
    version=$(. "$os_release" && printf '%s' "${VERSION_ID:-}")
    [[ $id == ubuntu ]] || die "нужен Ubuntu LTS, а не «${id}»"
    case $version in
    24.04 | 26.04) log "Ubuntu ${version}" ;;
    *) die "поддерживаются Ubuntu 24.04 и 26.04 LTS, а не ${version}" ;;
    esac
}

# Команда от имени пользователя деплоя: права root не применяются к путям, которыми он владеет.
as_deploy() { run runuser -u "$DEPLOY_USER" -- "$@"; }

apt_has() { apt-cache policy "$1" 2>/dev/null | grep -q 'Candidate: [0-9]'; }

setup_packages() {
    export DEBIAN_FRONTEND=noninteractive
    run apt-get update -q
    run apt-get install -yq ca-certificates curl gnupg lsb-release software-properties-common \
        unzip git acl ufw openssl python3
    # PHP 8.3 и PostgreSQL 16 есть в Ubuntu 24.04; в более новых — из PPA ondrej/php и PGDG.
    if ! query apt_has "php${PHP_VERSION}-fpm"; then
        run add-apt-repository -y ppa:ondrej/php
    fi
    if ! query apt_has "postgresql-${PG_VERSION}"; then
        run install -d -m 0755 /etc/apt/keyrings
        run curl -fsSL -o /etc/apt/keyrings/pgdg.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
        printf 'deb [signed-by=/etc/apt/keyrings/pgdg.asc] https://apt.postgresql.org/pub/repos/apt %s-pgdg main\n' \
            "$(lsb_release -cs 2>/dev/null || echo noble)" | put_file /etc/apt/sources.list.d/pgdg.list 0644
    fi
    if ! query bash -c "node -v | grep -q '^v${NODE_MAJOR}\\.'"; then
        run install -d -m 0755 /etc/apt/keyrings
        run bash -c "curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg"
        printf 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_%s.x nodistro main\n' \
            "$NODE_MAJOR" | put_file /etc/apt/sources.list.d/nodesource.list 0644
    fi
    run apt-get update -q
    local php=php${PHP_VERSION}
    run apt-get install -yq nginx certbot supervisor redis-server "postgresql-${PG_VERSION}" nodejs composer \
        docker.io docker-compose-v2 \
        "$php-fpm" "$php-cli" "$php-pgsql" "$php-mbstring" "$php-xml" "$php-curl" "$php-zip" \
        "$php-intl" "$php-bcmath" "$php-gd" "$php-redis" "$php-opcache" "$php-readline"
    run systemctl enable --now nginx "php${PHP_VERSION}-fpm" redis-server postgresql supervisor docker
}

setup_user() {
    [[ $DEPLOY_USER =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] || die "DEPLOY_USER — имя пользователя Linux"
    [[ $DEPLOY_USER != root ]] || die "DEPLOY_USER не может быть root"
    if ! query id -u "$DEPLOY_USER"; then
        run useradd --create-home --shell /bin/bash "$DEPLOY_USER"
    fi
    # Внутри своих каталогов пользователь деплоя может подложить симлинк (например shared/storage → /etc):
    # root по таким путям не ходит. APP_ROOT лежит в /var/www (root) — его создаёт root, если это не
    # симлинк; всё, что внутри, и ~/.ssh создаются от имени пользователя деплоя (runuser, без -o).
    [[ ! -L $APP_ROOT ]] || die "${APP_ROOT} — симлинк, provisioning остановлен"
    run install -d -m 0755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_ROOT"
    as_deploy install -d -m 0755 "$APP_ROOT/releases"
    as_deploy install -d -m 0755 "$APP_ROOT/shared"
    as_deploy install -d -m 0775 "$APP_ROOT/shared/storage"
    as_deploy install -d -m 0775 "$APP_ROOT/shared/storage/logs"
    # Ключ раннера (публичная часть DEPLOY_SSH_KEY) дописывается в authorized_keys, если его там нет;
    # другие ключи не трогаются. Пишет сам пользователь деплоя (симлинк в ~/.ssh не даст прав root).
    as_deploy install -d -m 0700 "/home/$DEPLOY_USER/.ssh"
    if [[ -n ${DEPLOY_AUTHORIZED_KEY:-} ]]; then
        valid_pubkey "$DEPLOY_AUTHORIZED_KEY" || die "DEPLOY_AUTHORIZED_KEY — не публичный ключ OpenSSH"
        # shellcheck disable=SC2016 # переменные раскрывает bash внутри runuser
        as_deploy bash -c 'umask 077; grep -qxF -- "$1" "$2" 2>/dev/null || printf "%s\n" "$1" >>"$2"' \
            _ "$DEPLOY_AUTHORIZED_KEY" "/home/$DEPLOY_USER/.ssh/authorized_keys"
    fi
    run install -d -m 0755 /var/www/letsencrypt
    # Журналы программ Supervisor: пишет supervisord от root, пользователю деплоя каталог недоступен.
    run install -d -m 0750 -o root -g adm /var/log/ymuzykant

    # Только то, что нужно deploy.sh: перезагрузка своего пула PHP-FPM и своих программ Supervisor.
    local sudoers
    sudoers=$(
        cat <<EOF
# deploy/provision.sh (0.1.4): права пользователя деплоя без root
${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl reload php${PHP_VERSION}-fpm
${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/bin/supervisorctl status ymuzykant\\:*
${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/bin/supervisorctl restart ymuzykant\\:*
${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/bin/supervisorctl start ymuzykant\\:*
EOF
    )
    if [[ $DRY_RUN == 1 ]]; then
        printf '%s\n' "$sudoers" | put_file /etc/sudoers.d/ymuzykant-deploy 0440
    else
        local tmp
        tmp=$(mktemp)
        printf '%s\n' "$sudoers" >"$tmp"
        visudo -cf "$tmp" >/dev/null || die "sudoers не прошёл visudo -c"
        put_file /etc/sudoers.d/ymuzykant-deploy 0440 <"$tmp"
        rm -f "$tmp"
    fi
}

setup_postgres() {
    # Пароль — из окружения через \getenv, не в argv и не в журнал.
    run runuser -u postgres -- psql -v ON_ERROR_STOP=1 -q <<'SQL'
\getenv pw DB_PASSWORD
SELECT 'CREATE ROLE ymuzykant LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ymuzykant')\gexec
ALTER ROLE ymuzykant WITH LOGIN PASSWORD :'pw';
SELECT 'CREATE DATABASE ymuzykant OWNER ymuzykant' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ymuzykant')\gexec
SQL
}

setup_services() {
    run install -d -m 0700 "$CONF_DIR"
    template services.compose.yaml | put_file "$CONF_DIR/services.compose.yaml" 0644
    {
        env_line MEILISEARCH_KEY "$MEILISEARCH_KEY"
        env_line MINIO_ROOT_USER "$MINIO_ROOT_USER"
        env_line MINIO_ROOT_PASSWORD "$MINIO_ROOT_PASSWORD"
    } | put_file "$CONF_DIR/services.env" 0600
    run docker compose --env-file "$CONF_DIR/services.env" -f "$CONF_DIR/services.compose.yaml" up -d --wait

    # Бакет и ключ приложения в MinIO (ключ root остаётся только у сервиса).
    local bucket=${AWS_BUCKET:-ymuzykant}
    [[ $bucket =~ ^[a-z0-9][a-z0-9.-]{2,62}$ ]] || die "AWS_BUCKET — имя бакета S3"
    [[ $AWS_ACCESS_KEY_ID =~ ^[A-Za-z0-9._-]{3,}$ ]] || die "AWS_ACCESS_KEY_ID: только латиница, цифры, . _ -"
    if [[ $DRY_RUN == 1 ]]; then
        printf '+ mc: бакет %s, пользователь приложения, политика readwrite\n' "$bucket"
        return 0
    fi
    local mc_host
    mc_host=$(python3 -c 'import os, urllib.parse as u; q = lambda k: u.quote(os.environ[k], safe=""); print(f"http://{q(\"MINIO_ROOT_USER\")}:{q(\"MINIO_ROOT_PASSWORD\")}@127.0.0.1:9000")')
    local mc=(docker compose --env-file "$CONF_DIR/services.env" -f "$CONF_DIR/services.compose.yaml" exec -T -e MC_HOST_root minio mc)
    MC_HOST_root=$mc_host "${mc[@]}" mb --ignore-existing "root/$bucket" >/dev/null
    # Секрет пользователя — через stdin (mc admin user add читает его, если не задан аргументом).
    printf '%s\n' "$AWS_SECRET_ACCESS_KEY" | MC_HOST_root=$mc_host "${mc[@]}" admin user add root "$AWS_ACCESS_KEY_ID" >/dev/null
    if ! MC_HOST_root=$mc_host "${mc[@]}" admin user info root "$AWS_ACCESS_KEY_ID" | grep -q readwrite; then
        MC_HOST_root=$mc_host "${mc[@]}" admin policy attach root readwrite --user "$AWS_ACCESS_KEY_ID" >/dev/null
    fi
}

setup_php() {
    template php/pool.conf | put_file "/etc/php/${PHP_VERSION}/fpm/pool.d/ymuzykant.conf" 0644
    put_file "/etc/php/${PHP_VERSION}/fpm/conf.d/90-ymuzykant.ini" 0644 <"$HERE/php/ymuzykant.ini"
    put_file "/etc/php/${PHP_VERSION}/cli/conf.d/90-ymuzykant.ini" 0644 <"$HERE/php/ymuzykant.ini"
    if changed "/etc/php/"; then run systemctl reload "php${PHP_VERSION}-fpm"; fi
}

setup_supervisor() {
    template supervisor/ymuzykant.conf | put_file /etc/supervisor/conf.d/ymuzykant.conf 0644
    run supervisorctl reread
    run supervisorctl update
}

setup_nginx() {
    run install -d -m 0755 /etc/nginx/ymuzykant
    put_file /etc/nginx/ymuzykant/security-headers.conf 0644 <"$HERE/nginx/security-headers.conf"
    htpasswd_line "$STAGE_BASIC_AUTH_USER" "$STAGE_BASIC_AUTH_PASSWORD" | put_file /etc/nginx/ymuzykant/stage.htpasswd 0640 root:www-data
    htpasswd_line "$MAILPIT_UI_USER" "$MAILPIT_UI_PASSWORD" | put_file /etc/nginx/ymuzykant/mailpit.htpasswd 0640 root:www-data
    run rm -f /etc/nginx/sites-enabled/default

    if ! query test -s "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"; then
        # До сертификата — только проверка certbot по HTTP (DNS домена уже указывает на сервер).
        template nginx/acme.conf | put_file /etc/nginx/sites-available/ymuzykant 0644
        run ln -sfn /etc/nginx/sites-available/ymuzykant /etc/nginx/sites-enabled/ymuzykant
        run nginx -t
        run systemctl reload nginx
        run certbot certonly --webroot -w /var/www/letsencrypt -d "$DOMAIN" \
            --email "$CERTBOT_EMAIL" --agree-tos --no-eff-email --non-interactive
    fi
    printf '#!/bin/sh\nsystemctl reload nginx\n' | put_file /etc/letsencrypt/renewal-hooks/deploy/reload-nginx 0755

    template nginx/ymuzykant.conf | put_file /etc/nginx/sites-available/ymuzykant 0644
    run ln -sfn /etc/nginx/sites-available/ymuzykant /etc/nginx/sites-enabled/ymuzykant
    run nginx -t
    run systemctl reload nginx
}

setup_firewall() {
    run ufw default deny incoming
    run ufw default allow outgoing
    local ssh_port=${DEPLOY_PORT:-22}
    [[ $ssh_port =~ ^[0-9]+$ ]] || die "DEPLOY_PORT — не номер порта"
    run ufw allow "${ssh_port}/tcp"
    run ufw allow 80/tcp
    run ufw allow 443/tcp
    run ufw --force enable
}

provision_apply() {
    local env_file=${1:-}
    if [[ -n $env_file ]]; then
        set -a
        # shellcheck disable=SC1090
        source "$env_file"
        set +a
    fi
    require_vars "${REQUIRED_VARS[@]}"
    DOMAIN=$(url_host "$APP_URL")
    [[ $DRY_RUN == 1 ]] && log "DRY-RUN: план для чистого сервера, изменений нет"
    check_os
    log "Пакеты"
    setup_packages
    log "Пользователь деплоя ${DEPLOY_USER} и каталоги ${APP_ROOT}"
    setup_user
    log "PostgreSQL ${PG_VERSION}"
    setup_postgres
    log "Meilisearch, Mailpit, MinIO (Docker, 127.0.0.1)"
    setup_services
    log "PHP ${PHP_VERSION}-FPM"
    setup_php
    log "Supervisor"
    setup_supervisor
    log "Nginx и HTTPS для ${DOMAIN}"
    setup_nginx
    log "Firewall"
    setup_firewall
    log "Сервер готов. Дальше — проверка входа по ключу и sshd (provision.sh remote делает это сам)"
}

# ---------- сервер: вход только по ключу (задача 0.1.12) ----------

# В authorized_keys есть хотя бы один публичный ключ OpenSSH.
has_authorized_key() {
    local file=$1 line
    [[ -f $file && ! -L $file ]] || return 1
    while IFS= read -r line || [[ -n $line ]]; do
        valid_pubkey "$line" && return 0
    done <"$file"
    return 1
}

SSHD_CONF=/etc/ssh/sshd_config.d/00-ymuzykant.conf

# Вызывает provision.sh remote после того, как раннер вошёл пользователем деплоя по ключу.
# Сам ещё раз проверяет ключи root и пользователя деплоя: без них sshd не меняется.
provision_sshd() {
    local env_file=${1:-} fs=${PROVISION_FS_ROOT:-} home want
    if [[ -n $env_file ]]; then
        set -a
        # shellcheck disable=SC1090
        source "$env_file"
        set +a
    fi
    require_vars DEPLOY_USER
    [[ $DEPLOY_USER =~ ^[a-z_][a-z0-9_-]{0,31}$ && $DEPLOY_USER != root ]] || die "DEPLOY_USER — имя пользователя Linux, не root"
    check_os
    for home in "$fs/root" "$fs/home/$DEPLOY_USER"; do
        has_authorized_key "$home/.ssh/authorized_keys" ||
            die "нет ключа в authorized_keys ${home#"$fs"} — sshd не изменён, вход по паролю оставлен"
    done
    put_file "$SSHD_CONF" 0644 <"$HERE/ssh/00-ymuzykant.conf"
    if ! run sshd -t; then
        run rm -f "$SSHD_CONF"
        die "sshd -t не принял конфигурацию — файл удалён, sshd не изменён"
    fi
    # Итоговые значения (sshd -T) — те, что в нашем файле: его не перекрыл другой конфиг и Include есть.
    if [[ $DRY_RUN == 1 ]]; then
        run sshd -T
    else
        local effective
        effective=$(sshd -T 2>/dev/null)
        # prohibit-password sshd -T печатает и как without-password (старое имя).
        for want in 'passwordauthentication no' 'kbdinteractiveauthentication no' \
            'permitrootlogin (prohibit-password|without-password)' 'pubkeyauthentication yes'; do
            grep -qxE "$want" <<<"$effective" || {
                rm -f "$SSHD_CONF"
                die "sshd -T: нет «${want}» (конфигурацию перекрывает другой файл) — файл удалён, sshd не изменён"
            }
        done
    fi
    run systemctl reload-or-restart ssh
    log "Вход по паролю выключен; root — только по ключу"
}

case ${1:-} in
remote) provision_remote ;;
apply) provision_apply "${2:-}" ;;
sshd) provision_sshd "${2:-}" ;;
*)
    sed -n '2,10p' "${BASH_SOURCE[0]}" >&2
    exit 2
    ;;
esac
