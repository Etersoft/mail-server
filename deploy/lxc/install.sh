#!/bin/sh
# Установка и обновление mail-server, subscription-facade и mail-sorter
# в контейнере (LXC или ВМ) на ALT Linux p11/Sisyphus без docker.
#
#   ./install.sh                 установить или обновить до master
#   REF=v1.0 ./install.sh        конкретная ветка или тег (для всех трёх)
#   REPO_BASE=git@gitlab.eterfund.ru:eterfund ./install.sh   другой git-сервер
#   ./install.sh --no-start      только собрать и разложить файлы
#
# Повторный запуск обновляет код, пересобирает и перезапускает службы;
# конфигурация в /etc/eterfund-mail не перезаписывается.
set -eu

REPO_BASE=${REPO_BASE:-https://github.com/Etersoft}
# адрес репозитория: $REPO_BASE/<проект>$REPO_SUFFIX (для локальных каталогов REPO_SUFFIX=)
REPO_SUFFIX=${REPO_SUFFIX-.git}
REF=${REF:-master}
PREFIX=/opt/eterfund-mail
ETC=/etc/eterfund-mail
APP_USER=mailing
HERE=$(cd "$(dirname "$0")" && pwd)

START=1
for arg in "$@"; do
    case "$arg" in
        --no-start) START= ;;
        -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
        *) echo "Unknown option: $arg" >&2; exit 1 ;;
    esac
done

log () {
    echo "=== $*"
}

# runuser из util-linux есть и в минимальной системе, в отличие от su
as_app () {
    runuser -u "$APP_USER" -- env HOME="$PREFIX" sh -c "$*"
}

[ "$(id -u)" = 0 ] || { echo "Run as root" >&2; exit 1; }

log "Packages"
apt-get update -q
apt-get install -y -q node npm git redis nginx postfix

if ! id "$APP_USER" >/dev/null 2>&1; then
    log "User $APP_USER"
    useradd -r -d "$PREFIX" -s /sbin/nologin "$APP_USER"
fi
install -d -o "$APP_USER" -g "$APP_USER" -m 755 "$PREFIX"

log "Configuration in $ETC"
install -d -m 750 -g "$APP_USER" "$ETC" "$ETC/templates" "$ETC/templates/subscription-facade"
for name in mail-server.json subscription-facade.json mail-sorter.json mail-sorter.env; do
    if [ ! -e "$ETC/$name" ]; then
        install -m 640 -g "$APP_USER" "$HERE/config/$name" "$ETC/$name"
        echo "created $ETC/$name — edit it"
    fi
done

fetch () {
    name=$1
    dir="$PREFIX/$name"
    if [ -d "$dir/.git" ]; then
        as_app "cd '$dir' && git fetch -q --tags origin && git checkout -q --detach 'origin/$REF' 2>/dev/null || git checkout -q --detach '$REF'"
    else
        as_app "git clone -q '$REPO_BASE/$name$REPO_SUFFIX' '$dir' && cd '$dir' && git checkout -q --detach '$REF'"
    fi
    echo "$name: $(as_app "git -C '$dir' log --oneline -1")"
}

# Файл из $ETC подкладывается в каталог проекта символьной ссылкой;
# пример берётся из проекта, если своего файла ещё нет
link_config () {
    target=$1 link=$2 example=${3:-}
    if [ ! -e "$target" ] && [ -n "$example" ]; then
        install -m 640 -g "$APP_USER" "$example" "$target"
        echo "created $target from example — edit it"
    fi
    ln -sfn "$target" "$link"
}

log "mail-server"
fetch mail-server
link_config "$ETC/mail-server.json" "$PREFIX/mail-server/config.json"
link_config "$ETC/templates/confirm-subscription.hbs" \
    "$PREFIX/mail-server/templates/confirm-subscription.hbs" \
    "$PREFIX/mail-server/templates/confirm-subscription.hbs.example"
# client.* из конфига встраивается в клиент при сборке
as_app "cd '$PREFIX/mail-server' && npm ci --ignore-scripts --no-audit --no-fund \
    && npm run server:build && npm run client:build && npm prune --omit=dev --no-audit"

log "subscription-facade"
fetch subscription-facade
link_config "$ETC/subscription-facade.json" "$PREFIX/subscription-facade/config.json"
for example in "$PREFIX"/subscription-facade/templates/*.hbs.example; do
    base=$(basename "$example" .example)
    link_config "$ETC/templates/subscription-facade/$base" \
        "$PREFIX/subscription-facade/templates/$base" "$example"
done
as_app "cd '$PREFIX/subscription-facade' && npm ci --ignore-scripts --no-audit --no-fund \
    && npm run build && npm prune --omit=dev --no-audit"

log "mail-sorter"
fetch mail-sorter
link_config "$ETC/mail-sorter.json" "$PREFIX/mail-sorter/config.json"
as_app "cd '$PREFIX/mail-sorter' && npm ci --omit=dev --ignore-scripts --no-audit --no-fund"

log "systemd units, nginx"
install -d /etc/systemd/system
install -m 644 "$HERE"/systemd/*.service "$HERE"/systemd/*.timer /etc/systemd/system/
if [ ! -e /etc/nginx/sites-available.d/eterfund-mail.conf ]; then
    install -m 644 "$HERE/nginx/eterfund-mail.conf" /etc/nginx/sites-available.d/
    echo "created /etc/nginx/sites-available.d/eterfund-mail.conf — edit server_name and allow"
fi
ln -sfn ../sites-available.d/eterfund-mail.conf /etc/nginx/sites-enabled.d/eterfund-mail.conf

log "Redis persistence, local SMTP relay"
# Рассылки хранятся только в Redis: журнал AOF, чтобы не терять данные
REDIS_CHANGED=
if grep -q '^appendonly no' /etc/redis/redis.conf; then
    sed -i 's/^appendonly no/appendonly yes/' /etc/redis/redis.conf
    REDIS_CHANGED=1
fi
# postfix принимает письма только с localhost; отправку наружу (SPF, DKIM,
# relayhost) настраивает администратор
postconf -e 'inet_interfaces = loopback-only' 'mynetworks = 127.0.0.0/8 [::1]/128'

[ -n "$START" ] || { log "Done (services not started)"; exit 0; }

log "Start"
systemctl daemon-reload
systemctl enable --now redis postfix nginx
[ -z "$REDIS_CHANGED" ] || systemctl restart redis
systemctl enable mail-server subscription-facade mail-sorter.timer
systemctl restart mail-server subscription-facade
systemctl start mail-sorter.timer
nginx -t && systemctl reload nginx
systemctl --no-pager --lines=0 status mail-server subscription-facade mail-sorter.timer || :
log "Done"
