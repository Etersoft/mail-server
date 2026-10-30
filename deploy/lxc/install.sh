#!/bin/sh
# Первичная установка mail-server, subscription-facade и mail-sorter
# в контейнере (LXC или ВМ) на ALT Linux p11/Sisyphus без docker.
#
#   ./install.sh                 установить master
#   REF=v1.0 ./install.sh        конкретная ветка или тег (для всех трёх)
#   REPO_BASE=git@gitlab.eterfund.ru:eterfund ./install.sh   другой git-сервер
#   ./install.sh --no-start      только собрать и разложить файлы
#
# Ставит пакеты, настраивает Redis, postfix и nginx. Регулярные обновления —
# update.sh (он не трогает систему); конфигурация в /etc/eterfund-mail не
# перезаписывается.
set -eu

# REPO_BASE и REPO_SUFFIX передаются в update.sh: адрес репозитория —
# $REPO_BASE/<проект>$REPO_SUFFIX (для локальных каталогов REPO_SUFFIX=)
REF=${REF:-master}
PREFIX=/opt/eterfund-mail
ETC=/etc/eterfund-mail
APP_USER=mailing
HERE=$(cd "$(dirname "$0")" && pwd)

START=1
for arg in "$@"; do
    case "$arg" in
        --no-start) START= ;;
        -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
        *) echo "Unknown option: $arg" >&2; exit 1 ;;
    esac
done

log () {
    echo "=== $*"
}

[ "$(id -u)" = 0 ] || { echo "Run as root" >&2; exit 1; }

log "Packages"
apt-get update -q
apt-get install -y -q node npm git redis nginx postfix

if ! id "$APP_USER" >/dev/null 2>&1; then
    log "User $APP_USER"
    useradd -r -d "$PREFIX" -s /sbin/nologin "$APP_USER"
fi

log "Configuration in $ETC"
install -d -m 750 -g "$APP_USER" "$ETC" "$ETC/templates" "$ETC/templates/subscription-facade"
for name in mail-server.json subscription-facade.json mail-sorter.json mail-sorter.env; do
    if [ ! -e "$ETC/$name" ]; then
        install -m 640 -g "$APP_USER" "$HERE/config/$name" "$ETC/$name"
        echo "created $ETC/$name — edit it"
    fi
done

# Код: релизы в $PREFIX/releases от mailing-build (см. update.sh); прежняя
# схема с клонами от mailing переводится migrate.sh
"$HERE/migrate.sh"
"$HERE/update.sh" --no-restart all "$REF"

# Шаблоны из примеров в релизах, если своих ещё нет
install_example () {
    target=$1 example=$2
    if [ ! -e "$target" ] && [ -e "$example" ]; then
        install -m 640 -g "$APP_USER" "$example" "$target"
        echo "created $target from example — edit it"
    fi
}
install_example "$ETC/templates/confirm-subscription.hbs" \
    "$PREFIX/mail-server/templates/confirm-subscription.hbs.example"
for example in "$PREFIX"/subscription-facade/templates/*.hbs.example; do
    install_example "$ETC/templates/subscription-facade/$(basename "$example" .example)" "$example"
done

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
