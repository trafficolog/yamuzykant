#!/usr/bin/env bash
# Дымовая проверка wss-прокси Reverb (задача 0.1.16). Запускается вручную после выкатки, с любой машины:
#   deploy/bin/smoke-reverb.sh <домен> <REVERB_APP_KEY>
#   SMOKE_BASIC_AUTH=stage:пароль deploy/bin/smoke-reverb.sh stage.example.ru <ключ>   # stage за паролем
# Проверяет: TLS и Nginx пропускают Upgrade на /app/{ключ}, ответ 101, Reverb присылает
# pusher:connection_established, а Origin страницы разрешён (REVERB_ALLOWED_ORIGINS).
# Доставку сообщений между двумя вкладками скрипт не проверяет — это шаг чек-листа G1.
# REVERB_APP_KEY — публичный ключ (он же в HTML страницы), не секрет; пароль stage уходит curl через stdin.
set -euo pipefail

(($# == 2)) || {
    sed -n '2,6p' "${BASH_SOURCE[0]}" >&2
    exit 2
}
host=$1
key=$2
[[ $host =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] || {
    echo "недопустимый домен «$host»" >&2
    exit 2
}
[[ $key =~ ^[A-Za-z0-9._-]+$ ]] || {
    echo "недопустимый ключ приложения" >&2
    exit 2
}

auth=()
if [[ -n ${SMOKE_BASIC_AUTH:-} ]]; then
    auth=(-K -)
fi

# Рукопожатие WebSocket вручную: curl не закрывает соединение сам, ждём --max-time и читаем, что успело прийти.
response=$(
    if [[ -n ${SMOKE_BASIC_AUTH:-} ]]; then printf 'user = "%s"\n' "$SMOKE_BASIC_AUTH"; fi |
        curl -sS --include --http1.1 --max-time 5 "${auth[@]}" \
            -H 'Connection: Upgrade' \
            -H 'Upgrade: websocket' \
            -H 'Sec-WebSocket-Version: 13' \
            -H "Sec-WebSocket-Key: $(head -c 16 /dev/urandom | base64)" \
            -H "Origin: https://${host}" \
            "https://${host}/app/${key}?protocol=7&client=smoke&version=1.0" 2>/dev/null || true
)

if ! grep -qE '^HTTP/1\.1 101' <<<"$response"; then
    echo "FAIL: рукопожатие не вернуло 101: $(head -n1 <<<"$response" | tr -d '\r')" >&2
    echo "Проверьте: Reverb запущен (supervisorctl status ymuzykant:ymuzykant-reverb), в Nginx есть location /app/." >&2
    exit 1
fi
if ! grep -q 'pusher:connection_established' <<<"$response"; then
    echo "FAIL: 101 есть, но pusher:connection_established не пришло (неверный REVERB_APP_KEY или Origin не в REVERB_ALLOWED_ORIGINS)" >&2
    exit 1
fi
echo "OK: wss://${host}/app/ — соединение установлено"
