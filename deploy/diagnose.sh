#!/usr/bin/env bash
# Диагностика stage только на чтение (задача 0.1.12): provision.yml, команда diagnose.
# Репозиторий публичный, журнал Actions видят все — печатается только безопасное:
# проверки /health (имена и статусы), по последним ошибкам Laravel — время, уровень, класс
# исключения, код и file:line (текст сообщения НЕ печатается: в нём бывают данные SQL, URL
# с токенами, ключи S3), права каталогов и состояние процессов. На сервере ничего не меняется.
set -euo pipefail

# shellcheck source=deploy/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

APP_ROOT=${DEPLOY_APP_ROOT:-$YM_DEFAULT_APP_ROOT}

# Строка журнала Laravel → «время уровень класс code=… file:line», без текста сообщения.
error_summary() {
    sed -nE \
        -e 's/^\[([^]]+)\] [a-z]+\.([A-Z]+): .*\[object\] \(([A-Za-z0-9_\]+)\(code: ([^)]{0,20})\).* at ([^ ]+:[0-9]+)\).*$/\1 \2 \3 code=\4 \5/p;t' \
        -e 's/^\[([^]]+)\] [a-z]+\.([A-Z]+): .*$/\1 \2 (без исключения)/p' |
        cut -c1-300
}

# Выполняется на сервере (от root): читает и печатает, ничего не пишет.
remote_script() {
    cat <<'REMOTE'
set -uo pipefail
root=$1
REMOTE
    declare -f error_summary
    cat <<'REMOTE'
host=$(sed -n 's/^APP_URL="\{0,1\}https\{0,1\}:\/\/\([^"/]*\).*/\1/p' "$root/shared/.env" | head -1)
[ -n "$host" ] || echo "в shared/.env нет APP_URL"
echo "== /health с сервера ($host)"
curl -sk --max-time 15 --resolve "$host:443:127.0.0.1" "https://$host/health" || echo "(нет ответа)"
echo
echo "== релизы"
readlink "$root/current" || echo "(current нет)"
echo "== права"
for d in shared/storage shared/storage/logs shared/storage/framework current/bootstrap/cache; do
    stat -c '%A %U:%G %n' "$root/$d" 2>/dev/null || echo "нет $d"
done
grep -h '^user\|^group' /etc/php/8.3/fpm/pool.d/ymuzykant.conf 2>/dev/null
echo "== процессы"
supervisorctl status 'ymuzykant:*' 2>&1 | cut -c1-120
systemctl is-active php8.3-fpm nginx postgresql 2>&1 | paste -sd' '
echo "== последние ошибки Laravel (время, уровень, класс, код, file:line — без текста)"
log=$(ls -t "$root"/shared/storage/logs/*.log 2>/dev/null | head -1)
if [ -n "$log" ]; then
    echo "файл: $(basename "$log")"
    grep -E '^\[[0-9-]+[ T][0-9:.+-]+\] [a-z]+\.(ERROR|CRITICAL|ALERT|EMERGENCY):' "$log" | tail -5 | error_summary
else
    echo "(журналов нет)"
fi
REMOTE
}

main() {
    require_vars DEPLOY_HOST
    : "${DEPLOY_HOST:?}"
    local user=${PROVISION_USER:-root} tmp
    check_ssh_target "$user" "$DEPLOY_HOST"
    tmp=$(mktemp -d)
    # shellcheck disable=SC2064
    trap "rm -rf '$tmp'" EXIT
    ssh_setup "$tmp"
    remote_script | ssh "${SSH_OPTS[@]}" "${user}@${DEPLOY_HOST}" bash -s -- "$(printf '%q' "$APP_ROOT")"
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
    main "$@"
fi
