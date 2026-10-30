#!/bin/sh
# Перевод установки на схему с релизами (см. update.sh). Можно запускать
# повторно: сделанное пропускается.
#
#   ./migrate.sh
#
# - создаёт пользователя mailing-build (владелец кода, сборка) с HOME
#   /var/lib/eterfund-mail-build (кэш npm и git-зеркала);
# - /opt/eterfund-mail отдаётся root, кэш npm пользователя mailing удаляется;
# - каталог-клон /opt/eterfund-mail/<проект> переносится в
#   /opt/eterfund-mail/releases/<проект>/00000000-000000-<коммит> и
#   становится первым релизом, а на его месте — ссылка. Службы продолжают
#   работать, пути в юнитах и nginx не меняются.
# Затем: ./update.sh all — собрать новые релизы.
set -eu

PREFIX=/opt/eterfund-mail
APP_USER=mailing
BUILD_USER=mailing-build
BUILD_HOME=/var/lib/eterfund-mail-build
RELEASES=$PREFIX/releases
PROJECTS="mail-server subscription-facade mail-sorter"

log () {
    echo "=== $*"
}

[ "$(id -u)" = 0 ] || { echo "Run as root" >&2; exit 1; }

if ! id "$BUILD_USER" >/dev/null 2>&1; then
    log "User $BUILD_USER"
    useradd -r -d "$BUILD_HOME" -s /sbin/nologin "$BUILD_USER"
fi
install -d -o "$BUILD_USER" -g "$BUILD_USER" -m 750 "$BUILD_HOME"

# mailing не должен менять ни код, ни ссылки на релизы
install -d -m 755 "$PREFIX"
chown root:root "$PREFIX"
chmod 755 "$PREFIX"
install -d -m 755 "$RELEASES"
# кэш npm от прежних сборок от mailing
rm -rf "${PREFIX:?}/.npm"

for name in $PROJECTS; do
    dir=$PREFIX/$name
    if [ -L "$dir" ] || [ ! -d "$dir" ]; then
        continue
    fi
    rev=$(git -c safe.directory='*' -C "$dir" rev-parse --short=10 HEAD 2>/dev/null || echo legacy)
    release=00000000-000000-$rev
    log "$name: $dir -> releases/$name/$release"
    install -d -o "$BUILD_USER" -g "$BUILD_USER" -m 755 "$RELEASES/$name"
    mv -T "$dir" "$RELEASES/$name/$release"
    ln -sfn "releases/$name/$release" "$dir"
    chown -R -h "$BUILD_USER:$BUILD_USER" "$RELEASES/$name/$release"
    chmod -R u+rwX,go+rX,go-w "$RELEASES/$name/$release"
done

# Проверка: mailing не может писать ни в код, ни в каталог со ссылками
for path in "$PREFIX" "$RELEASES" "$RELEASES"/*/* ; do
    [ -e "$path" ] || continue
    if runuser -u "$APP_USER" -- test -w "$path"; then
        echo "WARNING: $APP_USER can write to $path" >&2
    fi
done
log "Done; now run ./update.sh all"
