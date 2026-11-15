#!/usr/bin/env bash
# Команды программ Supervisor (deploy/supervisor/ymuzykant.conf). Запускается из current:
#   queue      — Horizon, если установлен (очереди high,default — в config/horizon.php),
#                иначе queue:work по очередям high,default (письма с кодом входа — в high)
#   reverb     — reverb:start на 127.0.0.1:8080; пока Reverb не установлен — ожидание
#   ssr        — Inertia SSR на 127.0.0.1:13714
#   scheduler  — schedule:work
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

has_command() {
    php artisan list --raw 2>/dev/null | awk '{print $1}' | grep -qx -- "$1"
}

case ${1:-} in
queue)
    if has_command horizon; then exec php artisan horizon; fi
    exec php artisan queue:work redis --queue=high,default --sleep=1 --tries=3 --max-time=3600
    ;;
reverb)
    # Каждое соединение — дескриптор: поднимаем мягкий лимит до жёсткого (потолок задаёт supervisord/ОС).
    ulimit -n "${REVERB_NOFILE:-10000}" 2>/dev/null || ulimit -n "$(ulimit -Hn)" 2>/dev/null || true
    if has_command reverb:start; then exec php artisan reverb:start --host=127.0.0.1 --port=8080; fi
    echo "Reverb не установлен — программа ждёт следующей выкатки"
    exec sleep infinity
    ;;
ssr) exec php artisan inertia:start-ssr ;;
scheduler) exec php artisan schedule:work ;;
*)
    echo "использование: worker.sh queue|reverb|ssr|scheduler" >&2
    exit 2
    ;;
esac
