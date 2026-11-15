#!/usr/bin/env bash
# Выкатка ЯМузыканта без простоя (задача 0.1.4, docs/02-process/CI-CD.md §6).
#
# С раннера GitHub Actions (deploy.yml, release.yml, provision.yml):
#   deploy/deploy.sh <stage|production> <sha>   выкатить проверенный SHA (= HEAD checkout)
#   deploy/deploy.sh rollback <stage|production>  вернуть предыдущий релиз по SSH
# На сервере (вызывает раннер по SSH или OWNER вручную):
#   deploy/deploy.sh rollback                    вернуть предыдущий релиз (≤ 1 мин: без сборки)
#   deploy/deploy.sh server-release <id>         собрать распакованный релиз и переключиться на него
#
# Раскладка на сервере ($DEPLOY_APP_ROOT, по умолчанию /var/www/ymuzykant):
#   releases/<UTC-время>-<sha12>/  shared/.env  shared/storage/  current -> releases/<id>
# Переключение — атомарная замена симлинка current после сборки, миграций и кэшей. Падение любого
# шага до переключения (в том числе migrate) оставляет current как был. Не прошла проверка после
# переключения (/health, Horizon или очередь, Reverb, SSR) — автоматический откат на прежний релиз.
#
# Переменные раннера: DEPLOY_HOST, DEPLOY_USER, DEPLOY_KNOWN_HOSTS, [DEPLOY_PORT], APP_URL и секреты
# для .env (render_env ниже). DEPLOY_DRY_RUN=1 — проверить вход, собрать архив и .env, ничего не
# отправляя на сервер (пока OWNER не задал STAGE_DEPLOY_LIVE=true, CI-CD.md §5).
set -Eeuo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=deploy/lib.sh
source "$HERE/lib.sh"

APP_ROOT=${DEPLOY_APP_ROOT:-$YM_DEFAULT_APP_ROOT}
KEEP_RELEASES=${DEPLOY_KEEP_RELEASES:-5}
SETTLE_SECONDS=${DEPLOY_SETTLE_SECONDS:-5}
HEALTH_RETRIES=${DEPLOY_HEALTH_RETRIES:-10}
# Ожидание блокировки выкатки на сервере. Раннер передаёт своё значение в команду ssh: workflow
# держит timeout-minutes ≥ DEPLOY_LOCK_WAIT + время сборки (workflow-guards.test.mjs).
LOCK_WAIT=${DEPLOY_LOCK_WAIT:-900}
[[ $LOCK_WAIT =~ ^[0-9]+$ ]] || die "DEPLOY_LOCK_WAIT — число секунд"
FAILED_MARK=.deploy-failed
PHP_FPM_SERVICE=${DEPLOY_PHP_FPM_SERVICE:-php8.3-fpm}
RELEASE_ID_RE='^[0-9]{14}-[0-9a-f]{12}$'
PROGRAMS=(ymuzykant-queue ymuzykant-reverb ymuzykant-ssr ymuzykant-scheduler)

# ---------- .env из секретов окружения ----------

# Печатает .env окружения $1 в stdout. Значения — только из переменных окружения процесса.
ENV_REQUIRED=(APP_URL APP_KEY DB_PASSWORD MEILISEARCH_KEY AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY)

render_env() {
    local env=$1 host
    require_vars "${ENV_REQUIRED[@]}"
    host=$(url_host "$APP_URL")
    env_line APP_NAME 'ЯМузыкант'
    env_line APP_ENV "$env"
    env_line APP_KEY "$APP_KEY"
    env_line APP_DEBUG false
    env_line APP_URL "${APP_URL%/}"
    env_line APP_LOCALE ru
    env_line APP_FALLBACK_LOCALE ru
    env_line APP_FAKER_LOCALE ru_RU
    env_line LOG_CHANNEL stack
    env_line LOG_STACK daily
    env_line LOG_LEVEL info
    env_line DB_CONNECTION pgsql
    env_line DB_HOST 127.0.0.1
    env_line DB_PORT 5432
    env_line DB_DATABASE ymuzykant
    env_line DB_USERNAME ymuzykant
    env_line DB_PASSWORD "$DB_PASSWORD"
    env_line SESSION_DRIVER redis
    env_line SESSION_LIFETIME 120
    env_line SESSION_SECURE_COOKIE true
    env_line FILESYSTEM_DISK s3
    env_line QUEUE_CONNECTION redis
    env_line CACHE_STORE redis
    env_line CACHE_PREFIX "ymuzykant_${env}_"
    env_line REDIS_CLIENT predis
    env_line REDIS_HOST 127.0.0.1
    env_line REDIS_PORT 6379
    env_line SCOUT_DRIVER meilisearch
    env_line SCOUT_QUEUE true
    env_line SCOUT_PREFIX "${env}_"
    env_line MEILISEARCH_HOST http://127.0.0.1:7700
    env_line MEILISEARCH_KEY "$MEILISEARCH_KEY"
    # stage: Mailpit на сервере (127.0.0.1:1025); production задаёт свой SMTP (задача 6.4.1).
    env_line MAIL_MAILER smtp
    env_line MAIL_HOST "${MAIL_HOST:-127.0.0.1}"
    env_line MAIL_PORT "${MAIL_PORT:-1025}"
    env_line MAIL_USERNAME "${MAIL_USERNAME:-}"
    env_line MAIL_PASSWORD "${MAIL_PASSWORD:-}"
    env_line MAIL_FROM_ADDRESS "${MAIL_FROM_ADDRESS:-noreply@${host}}"
    env_line MAIL_FROM_NAME 'ЯМузыкант'
    # stage: MinIO на сервере (127.0.0.1:9000), ключ приложения создаёт provision.sh.
    env_line AWS_ACCESS_KEY_ID "$AWS_ACCESS_KEY_ID"
    env_line AWS_SECRET_ACCESS_KEY "$AWS_SECRET_ACCESS_KEY"
    env_line AWS_DEFAULT_REGION "${AWS_DEFAULT_REGION:-us-east-1}"
    env_line AWS_BUCKET "${AWS_BUCKET:-ymuzykant}"
    env_line AWS_ENDPOINT "${AWS_ENDPOINT:-http://127.0.0.1:9000}"
    env_line AWS_USE_PATH_STYLE_ENDPOINT true
    env_line INERTIA_SSR_ENABLED true
    env_line INERTIA_SSR_URL http://127.0.0.1:13714
    env_line LOGIN_CODE_STORE redis
    env_line VITE_APP_NAME 'ЯМузыкант'
    # Вещание включается только вместе с секретами Reverb: процесс reverb:start (Supervisor) и wss-прокси
    # Nginx стоят с provision.sh. Без секретов — null: log писал бы текст сообщений в журнал (ревью PR #119).
    if [[ -n ${REVERB_APP_SECRET:-} ]]; then
        require_vars REVERB_APP_ID REVERB_APP_KEY
        env_line BROADCAST_CONNECTION reverb
        env_line REVERB_APP_ID "$REVERB_APP_ID"
        env_line REVERB_APP_KEY "$REVERB_APP_KEY"
        env_line REVERB_APP_SECRET "$REVERB_APP_SECRET"
        # Приложение шлёт события на Reverb локально, без прокси.
        env_line REVERB_HOST 127.0.0.1
        env_line REVERB_PORT 8080
        env_line REVERB_SCHEME http
        env_line REVERB_SERVER_HOST 127.0.0.1
        env_line REVERB_SERVER_PORT 8080
        # Браузер подключается через Nginx по wss (shared prop realtime, config/broadcasting.php).
        env_line REVERB_PUBLIC_HOST "$host"
        env_line REVERB_PUBLIC_PORT 443
        env_line REVERB_PUBLIC_SCHEME https
        env_line REVERB_ALLOWED_ORIGINS "$host"
    else
        env_line BROADCAST_CONNECTION null
    fi
    if [[ -n ${YANDEX_CLIENT_ID:-} ]]; then
        env_line YANDEX_CLIENT_ID "$YANDEX_CLIENT_ID"
        env_line YANDEX_CLIENT_SECRET "${YANDEX_CLIENT_SECRET:-}"
    fi
    if [[ -n ${SENTRY_DSN:-} ]]; then
        env_line SENTRY_LARAVEL_DSN "$SENTRY_DSN"
        env_line VITE_SENTRY_DSN "$SENTRY_DSN"
    fi
}

# ---------- раннер ----------

check_target() {
    [[ ${1:-} == stage || ${1:-} == production ]] || die "окружение — stage или production, а не «${1:-}»"
}

remote() {
    # shellcheck disable=SC2029,SC2153 # команда собрана с printf %q; DEPLOY_HOST проверен require_vars
    ssh "${SSH_OPTS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" "$@"
}

runner_deploy() {
    local env=$1 sha=$2 head id tmp
    check_target "$env"
    [[ $sha =~ ^[0-9a-f]{40}$ ]] || die "SHA должен быть 40 hex-символов, получено «${sha}»"
    head=$(git -C "$HERE/.." rev-parse HEAD)
    [[ $head == "$sha" ]] || die "checkout на ${head}, а выкатывается ${sha}: SHA только из проверенного источника"
    id="$(date -u +%Y%m%d%H%M%S)-${sha:0:12}"

    tmp=$(mktemp -d)
    # shellcheck disable=SC2064 # путь фиксируется сейчас
    trap "rm -rf '$tmp'" EXIT
    if [[ ${DEPLOY_DRY_RUN:-0} == 1 ]]; then
        # До 0.1.12 секреты окружения могут быть не заведены: dry-run подставляет заглушки и
        # перечисляет недостающие имена (без значений).
        local name missing=()
        for name in "${ENV_REQUIRED[@]}"; do
            if [[ -z ${!name:-} ]]; then
                missing+=("$name")
                printf -v "$name" '%s' "dry-run-placeholder"
            fi
        done
        [[ $APP_URL == dry-run-placeholder ]] && APP_URL=https://stage.invalid
        ((${#missing[@]} == 0)) || warn "DRY-RUN: не заданы ${missing[*]} — для настоящей выкатки их нужно завести"
    fi
    (umask 077 && render_env "$env" >"$tmp/env")
    git -C "$HERE/.." archive --format=tar.gz -o "$tmp/release.tar.gz" "$sha"

    if [[ ${DEPLOY_DRY_RUN:-0} == 1 ]]; then
        log "DRY-RUN ${env}: релиз ${id}, архив $(wc -c <"$tmp/release.tar.gz") байт, .env: $(cut -d= -f1 "$tmp/env" | paste -sd' ')"
        log "DRY-RUN: на сервер ничего не отправлено (ssh, распаковка в releases/${id}, server-release)"
        return 0
    fi

    require_vars DEPLOY_HOST DEPLOY_USER
    check_ssh_target "$DEPLOY_USER" "$DEPLOY_HOST"
    ssh_setup "$tmp"
    local root rel
    root=$(printf '%q' "$APP_ROOT")
    rel=$(printf '%q' "$APP_ROOT/releases/$id")
    log "Загрузка релиза ${id} на ${env}"
    remote "set -e; test -d ${root}/shared; mkdir ${rel}; tar -xzf - -C ${rel}" <"$tmp/release.tar.gz"
    # shared/.env перезаписывается до сборки и вне flock сервера. Это безопасно: работающий релиз (и
    # тот, на который откатываемся) читает конфигурацию из своего bootstrap/cache/config.php
    # (config:cache при его выкатке), а не из shared/.env; новый .env применяется только релизом,
    # который пройдёт config:cache в server-release. Откат .env не возвращает — значения берутся
    # из кэша конфигурации релиза.
    log "Обновление shared/.env"
    remote "set -e; umask 077; cat > ${root}/shared/.env.next; mv -f ${root}/shared/.env.next ${root}/shared/.env" <"$tmp/env"
    log "Сборка и переключение на сервере"
    remote "DEPLOY_LOCK_WAIT=${LOCK_WAIT} bash ${rel}/deploy/deploy.sh server-release $(printf '%q' "$id")"
}

runner_rollback() {
    local env=$1 tmp
    check_target "$env"
    require_vars DEPLOY_HOST DEPLOY_USER
    check_ssh_target "$DEPLOY_USER" "$DEPLOY_HOST"
    tmp=$(mktemp -d)
    # shellcheck disable=SC2064
    trap "rm -rf '$tmp'" EXIT
    ssh_setup "$tmp"
    remote "DEPLOY_LOCK_WAIT=${LOCK_WAIT} bash $(printf '%q' "$APP_ROOT/current/deploy/deploy.sh") rollback"
}

# ---------- сервер ----------

artisan() { php artisan "$@"; }

# Есть ли команда artisan в релизе (Horizon, Reverb, Scout ставятся отдельными задачами).
has_command() {
    php artisan list --raw 2>/dev/null | awk '{print $1}' | grep -qx -- "$1"
}

# Выкатка и откат на сервере не идут одновременно: следующий ждёт (DEPLOY_LOCK_WAIT секунд),
# а не отменяется — в том числе ручной откат из provision.yml, у которого своя группа concurrency.
lock() {
    exec 9>"$APP_ROOT/.deploy.lock"
    if ! flock -n 9; then
        log "идёт другая выкатка или откат — ожидание блокировки до ${LOCK_WAIT} с"
        flock -w "$LOCK_WAIT" 9 || die "блокировка выкатки не освободилась за ${LOCK_WAIT} с: идёт другая выкатка или откат"
    fi
}

current_release() {
    [[ -L $APP_ROOT/current ]] || return 0
    basename "$(readlink "$APP_ROOT/current")"
}

switch_to() {
    local id=$1
    ln -sfn "releases/$id" "$APP_ROOT/current.next"
    mv -Tf "$APP_ROOT/current.next" "$APP_ROOT/current"
    log "current -> releases/${id}"
}

# Перезапуск фоновых процессов на код из current. Вызывается в `if !` (там set -e не действует),
# поэтому каждая обязательная команда возвращает ошибку явно.
restart_services() {
    sudo -n systemctl reload "$PHP_FPM_SERVICE" || {
        printf '::error::перезапуск: reload %s не прошёл\n' "$PHP_FPM_SERVICE" >&2
        return 1
    }
    (
        cd "$APP_ROOT/current" || exit 1
        if has_command horizon:terminate; then
            artisan horizon:terminate || exit 1
        else
            artisan queue:restart || exit 1
        fi
        if has_command reverb:restart; then artisan reverb:restart || exit 1; fi
    ) || {
        printf '::error::перезапуск: сигнал очереди или Reverb не прошёл\n' >&2
        return 1
    }
    # SSR и планировщик читают код только при старте. Reverb, пока не установлен, — программа-ожидание:
    # перезапуск подхватывает новый код. Ошибку supervisorctl (программа не запущена) не считаем
    # падением: состояние всех программ проверяет verify.
    local p
    for p in ymuzykant-ssr ymuzykant-scheduler ymuzykant-reverb; do
        sudo -n supervisorctl restart "ymuzykant:$p" >/dev/null || true
    done
    # Первая выкатка: до появления current программы не стартовали — запускаем остановленные.
    sudo -n supervisorctl start 'ymuzykant:*' >/dev/null || true
}

health_url() {
    local host
    host=$(url_host "$(grep -E '^APP_URL=' "$APP_ROOT/shared/.env" | head -n1 | cut -d= -f2- | tr -d "'\"")")
    printf '%s\n' "$host"
}

# Приложение и процессы живы: /health 200 через Nginx, программы Supervisor в RUNNING,
# Horizon (если установлен) — running, SSR отвечает на /health.
verify() {
    local host status failed=0 p i
    sleep "$SETTLE_SECONDS"
    host=$(health_url)
    for ((i = 1; i <= HEALTH_RETRIES; i++)); do
        if curl -fsS --max-time 5 -o /dev/null --resolve "${host}:443:127.0.0.1" "https://${host}/health"; then
            break
        fi
        if ((i == HEALTH_RETRIES)); then
            printf '::error::/health не ответил 200\n' >&2
            failed=1
        fi
        sleep 2
    done
    status=$(sudo -n supervisorctl status 'ymuzykant:*' || true)
    for p in "${PROGRAMS[@]}"; do
        if ! grep -Eq "^ymuzykant:${p}[[:space:]]+RUNNING" <<<"$status"; then
            printf '::error::%s не в состоянии RUNNING\n' "$p" >&2
            failed=1
        fi
    done
    if (cd "$APP_ROOT/current" && has_command horizon:status); then
        if ! (cd "$APP_ROOT/current" && artisan horizon:status) | grep -qi running; then
            printf '::error::Horizon не запущен\n' >&2
            failed=1
        fi
    fi
    if ! curl -fsS --max-time 5 -o /dev/null http://127.0.0.1:13714/health; then
        printf '::error::SSR не отвечает на 127.0.0.1:13714/health\n' >&2
        failed=1
    fi
    # Вещание reverb без слушающего процесса роняло бы задания трансляции в failed_jobs. Достаточно
    # любого HTTP-ответа: важно, что порт открыт.
    # Повторяем, как /health: после restart Reverb поднимается не мгновенно.
    if grep -qE "^BROADCAST_CONNECTION=['\"]?reverb['\"]?$" "$APP_ROOT/shared/.env"; then
        for ((i = 1; i <= HEALTH_RETRIES; i++)); do
            if curl -sS --max-time 5 -o /dev/null http://127.0.0.1:8080/up; then
                break
            fi
            if ((i == HEALTH_RETRIES)); then
                printf '::error::Reverb не отвечает на 127.0.0.1:8080, а BROADCAST_CONNECTION=reverb\n' >&2
                failed=1
            fi
            sleep 2
        done
    fi
    return "$failed"
}

# Модели для scout:import — по одной на строку в deploy/scout-import.txt; импортируются,
# только если Scout установлен и класс есть в релизе.
scout_steps() {
    if ! has_command scout:sync-index-settings; then
        log "Scout не установлен — индексы не обновляются"
        return 0
    fi
    artisan scout:sync-index-settings
    local model file
    while IFS= read -r model || [[ -n $model ]]; do
        model=${model%%#*}
        model=${model//[[:space:]]/}
        [[ -n $model ]] || continue
        file="${model#App\\}"
        file="app/${file//\\//}.php"
        if [[ -f $file ]] && has_command scout:import; then
            artisan scout:import "$model"
        else
            log "scout:import ${model}: класса нет в релизе — пропуск"
        fi
    done <deploy/scout-import.txt
}

# Рабочие релизы (без пометки неудачной выкатки) по возрастанию.
good_releases() {
    local id
    while IFS= read -r id; do
        [[ -e $APP_ROOT/releases/$id/$FAILED_MARK ]] || printf '%s\n' "$id"
    done < <(find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)
}

# Сначала удаляются релизы с автооткатом, затем рабочие сверх KEEP_RELEASES (current не трогается).
cleanup_releases() {
    local keep=() id cur
    cur=$(current_release)
    mapfile -t keep < <(good_releases | tail -n "$KEEP_RELEASES")
    while IFS= read -r id; do
        [[ $id == "$cur" ]] && continue
        printf '%s\n' "${keep[@]}" | grep -qx -- "$id" && continue
        rm -rf "${APP_ROOT:?}/releases/$id"
        log "удалён релиз ${id}"
    done < <(find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%f\n')
}

server_release() {
    local id=$1 rel prev
    SWITCHED=0
    [[ $id =~ $RELEASE_ID_RE ]] || die "неверный id релиза «${id}»"
    rel="$APP_ROOT/releases/$id"
    [[ -d $rel ]] || die "нет каталога releases/${id}"
    [[ -f $APP_ROOT/shared/.env ]] || die "нет shared/.env"
    lock
    prev=$(current_release)
    # Не дошли до переключения — недособранный релиз удаляется, current не меняется.
    # shellcheck disable=SC2064
    trap "if [[ \$SWITCHED == 0 ]]; then rm -rf '$rel'; printf '::error::релиз ${id} не выкачен, current остался на ${prev:-<нет>}\n' >&2; fi" EXIT

    log "Релиз ${id} (сейчас: ${prev:-нет})"
    mkdir -p "$APP_ROOT/shared/storage"/{app/public,framework/{cache/data,sessions,views},logs}
    ln -sfn "$APP_ROOT/shared/.env" "$rel/.env"
    rm -rf "$rel/storage"
    ln -sfn "$APP_ROOT/shared/storage" "$rel/storage"
    cd "$rel"

    composer install --no-dev --prefer-dist --no-interaction --no-progress --optimize-autoloader
    npm ci --no-audit --no-fund
    npm run build
    npm run build:ssr
    log "Миграции (падение отменяет переключение)"
    artisan migrate --force
    artisan config:cache
    artisan route:cache
    artisan view:cache
    scout_steps

    switch_to "$id"
    SWITCHED=1
    trap - EXIT

    # Перезапуск или проверка не прошли — автооткат; релиз помечается и не считается рабочим
    # (не входит в хранимые, ручной откат его пропускает, удаляется первым).
    if ! restart_services || ! verify; then
        : >"$rel/$FAILED_MARK"
        if [[ -n $prev && -d $APP_ROOT/releases/$prev ]]; then
            printf '::error::проверка после выкатки %s не прошла — откат на %s\n' "$id" "$prev" >&2
            switch_to "$prev"
            if ! restart_services || ! verify; then
                printf '::error::после отката на %s проверка тоже не прошла\n' "$prev" >&2
            fi
        else
            printf '::error::проверка после выкатки %s не прошла, прежнего релиза нет\n' "$id" >&2
        fi
        exit 1
    fi
    cleanup_releases
    log "Выкачен ${id}"
}

server_rollback() {
    local cur prev
    lock
    cur=$(current_release)
    [[ -n $cur ]] || die "нет текущего релиза"
    # Релизы с автооткатом пропускаются.
    prev=$(good_releases | awk -v c="$cur" '$0 < c' | tail -n1)
    [[ -n $prev ]] || die "нет рабочего релиза старше ${cur} — откатываться некуда"
    log "Откат ${cur} -> ${prev}"
    switch_to "$prev"
    restart_services || die "после отката на ${prev} перезапуск не прошёл"
    verify || die "после отката на ${prev} проверка не прошла"
    log "Откат на ${prev} выполнен"
}

usage() {
    sed -n '2,10p' "${BASH_SOURCE[0]}" >&2
    exit 2
}

main() {
    case ${1:-} in
    stage | production)
        (($# == 2)) || usage
        runner_deploy "$1" "$2"
        ;;
    rollback)
        if (($# == 2)); then
            runner_rollback "$2"
        elif (($# == 1)); then
            server_rollback
        else
            usage
        fi
        ;;
    server-release)
        (($# == 2)) || usage
        server_release "$2"
        ;;
    *) usage ;;
    esac
}

# Выполнение напрямую запускает main; через source (тесты render_env) — нет.
[[ ${BASH_SOURCE[0]} != "$0" ]] || main "$@"
