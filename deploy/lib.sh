#!/usr/bin/env bash
# Общие функции deploy/deploy.sh и deploy/provision.sh (задача 0.1.4). Подключается через `source`.
# Секреты не попадают в argv, в вывод и в журналы: только в файлы с правами 0600 и в stdin ssh.

# shellcheck disable=SC2034 # используется в deploy.sh и provision.sh
YM_DEFAULT_APP_ROOT=/var/www/ymuzykant

log() { printf '==> %s\n' "$*" >&2; }
warn() { printf '::warning::%s\n' "$*" >&2; }
die() {
    printf '::error::%s\n' "$*" >&2
    exit 1
}

# Строка .env: KEY='value'. Одинарные кавычки phpdotenv понимает буквально (без $-подстановок и
# экранирования). Значение с одинарной кавычкой — в двойных, если в нём нет ", \ и $. Перевод строки
# и прочие неоднозначные значения — отказ с именем переменной, без значения.
env_line() {
    local key=$1 value=$2
    [[ $key =~ ^[A-Z][A-Z0-9_]*$ ]] || die "env: недопустимое имя переменной ${key}"
    case $value in
    *$'\n'* | *$'\r'*) die "env: ${key} содержит перевод строки" ;;
    esac
    if [[ $value != *"'"* ]]; then
        printf "%s='%s'\n" "$key" "$value"
    elif [[ $value != *'"'* && $value != *\\* && $value != *'$'* ]]; then
        printf '%s="%s"\n' "$key" "$value"
    else
        die "env: ${key} содержит одновременно ' и один из символов \" \\ \$ — смените значение секрета"
    fi
}

# Хост из URL: https://stage.example.ru/ → stage.example.ru
url_host() {
    local url=${1#*://}
    url=${url%%/*}
    url=${url%%:*}
    [[ $url =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] || die "не удалось взять домен из «$1»"
    printf '%s\n' "$url"
}

# Обязательные переменные: перечисляет все пустые и падает (значения не печатаются).
require_vars() {
    local missing=() name
    for name in "$@"; do
        [[ -n ${!name:-} ]] || missing+=("$name")
    done
    ((${#missing[@]} == 0)) || die "не заданы переменные: ${missing[*]}"
}

# Параметры ssh: ключ сервера проверяется по known_hosts из секрета DEPLOY_KNOWN_HOSTS,
# без ssh-keyscan и без доверия первому подключению (StrictHostKeyChecking yes).
# Заполняет массив SSH_OPTS; файл known_hosts — во временном каталоге $1.
ssh_setup() {
    local dir=$1
    [[ -n ${DEPLOY_KNOWN_HOSTS:-} ]] || die "не задан секрет DEPLOY_KNOWN_HOSTS (отпечаток сервера, задача 0.1.12)"
    printf '%s\n' "$DEPLOY_KNOWN_HOSTS" >"$dir/known_hosts"
    chmod 600 "$dir/known_hosts"
    SSH_OPTS=(
        -o BatchMode=yes
        -o StrictHostKeyChecking=yes
        -o "UserKnownHostsFile=$dir/known_hosts"
        -o GlobalKnownHostsFile=/dev/null
        -o PasswordAuthentication=no
        -o KbdInteractiveAuthentication=no
        -o ConnectTimeout=20
        -o ServerAliveInterval=15
    )
    if [[ -n ${DEPLOY_PORT:-} ]]; then
        [[ $DEPLOY_PORT =~ ^[0-9]+$ ]] || die "DEPLOY_PORT — не номер порта"
        SSH_OPTS+=(-p "$DEPLOY_PORT")
    fi
}

# Строка — публичный ключ OpenSSH: «тип base64 [комментарий из печатных символов]».
valid_pubkey() {
    [[ $1 =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com)\ [A-Za-z0-9+/]+={0,3}(\ [[:print:]]*)?$ ]]
}

# Адресат ssh из секретов: имя пользователя Linux и хост или IP. Значение с пробелом, «-» в начале
# или «@» иначе стало бы опцией ssh (-oProxyCommand=…) или другим адресатом.
check_ssh_target() {
    local user=$1 host=$2
    [[ $user =~ ^[a-z_][a-z0-9_-]*$ ]] || die "имя пользователя SSH — строчная латиница, цифры, _ и -, не с «-»"
    [[ $host =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ || $host =~ ^[0-9A-Fa-f]*:[0-9A-Fa-f:]*$ ]] ||
        die "DEPLOY_HOST — имя хоста или IP-адрес без пробелов, «@» и «-» в начале"
}
