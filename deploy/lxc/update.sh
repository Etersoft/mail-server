#!/bin/sh
# Выкладка обновлений mail-server, subscription-facade и mail-sorter.
#
#   ./update.sh all|<проект> [ref]     собрать новый релиз (по умолчанию master)
#   ./update.sh --rollback <проект>     вернуть предыдущий релиз без сборки
#   ./update.sh --list [проект]         релизы и текущий
#   ./update.sh --no-restart ...        только собрать и переключить
#   REPO_BASE=git@gitlab.eterfund.ru:eterfund ./update.sh all   сменить git-сервер
#
# Код собирается от пользователя mailing-build в новый каталог
# /opt/eterfund-mail/releases/<проект>/<дата>-<коммит>, затем ссылка
# /opt/eterfund-mail/<проект> атомарно переключается на него и перезапускается
# только служба этого проекта. Если сборка не удалась, ничего не меняется.
# Службы работают от mailing, который код только читает. apt, postfix, Redis,
# nginx и /etc/eterfund-mail скрипт не трогает.
set -eu

PREFIX=/opt/eterfund-mail
ETC=/etc/eterfund-mail
APP_USER=mailing
BUILD_USER=mailing-build
BUILD_HOME=/var/lib/eterfund-mail-build
RELEASES=$PREFIX/releases
PROJECTS="mail-server subscription-facade mail-sorter"
# сколько последних релизов хранить (текущий не удаляется никогда)
KEEP=${KEEP:-3}
SYSTEMCTL=${SYSTEMCTL:-systemctl}
REPO_SUFFIX=${REPO_SUFFIX-.git}

usage () {
    sed -n '2,14p' "$0"
    exit "${1:-0}"
}

log () {
    echo "=== $*"
}

die () {
    echo "update.sh: $*" >&2
    exit 1
}

as_build () {
    runuser -u "$BUILD_USER" -- env HOME="$BUILD_HOME" sh -c "umask 022; $*"
}

# Функции sh не имеют локальных переменных, поэтому у каждой свои имена

# Сервис-зависимая часть: какая служба у проекта и что проверяет сборку
service_of () {
    case "$1" in
        mail-server|subscription-facade) echo "$1" ;;
        # oneshot по таймеру: следующий запуск возьмёт новый релиз
        mail-sorter) ;;
    esac
}

build_project () {
    bname=$1 bdir=$2
    case "$bname" in
        mail-server)
            # client.* встраивается в клиент при сборке; mailing-build не читает
            # /etc/eterfund-mail, поэтому ему даётся только раздел client
            node -e '
                const fs = require("fs");
                const config = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
                fs.writeFileSync(process.argv[2], JSON.stringify({ client: config.client || {} }));
            ' "$ETC/mail-server.json" "$bdir/config.json"
            chown "$BUILD_USER:" "$bdir/config.json"
            as_build "cd '$bdir' && npm ci --ignore-scripts --no-audit --no-fund \
                && npm run server:build && npm run client:build && npm prune --omit=dev --no-audit"
            rm -f "$bdir/config.json"
            ;;
        subscription-facade)
            as_build "cd '$bdir' && npm ci --ignore-scripts --no-audit --no-fund \
                && npm run build && npm prune --omit=dev --no-audit"
            ;;
        mail-sorter)
            as_build "cd '$bdir' && npm ci --omit=dev --ignore-scripts --no-audit --no-fund"
            ;;
    esac
}

# Конфигурация и шаблоны из $ETC — символьными ссылками в каждом релизе
link_config () {
    lname=$1 ldir=$2
    ln -sfn "$ETC/$lname.json" "$ldir/config.json"
    case "$lname" in
        mail-server)
            ln -sfn "$ETC/templates/confirm-subscription.hbs" \
                "$ldir/templates/confirm-subscription.hbs"
            ;;
        subscription-facade)
            for example in "$ldir"/templates/*.hbs.example; do
                [ -e "$example" ] || continue
                base=$(basename "$example" .example)
                ln -sfn "$ETC/templates/subscription-facade/$base" "$ldir/templates/$base"
            done
            ;;
    esac
}

current_release () {
    link=$PREFIX/$1
    [ -L "$link" ] || return 0
    basename "$(readlink "$link")"
}

list_releases () {
    [ -d "$RELEASES/$1" ] || return 0
    # имена начинаются с даты, поэтому сортировка по имени — по времени
    for dir in "$RELEASES/$1"/*; do
        [ -d "$dir" ] || continue
        case "$dir" in *.tmp) continue ;; esac
        basename "$dir"
    done | sort
}

# Атомарная замена ссылки: rename() поверх старой ссылки
switch_to () {
    name=$1 release=$2
    link=$PREFIX/$name
    if [ -e "$link" ] && [ ! -L "$link" ]; then
        die "$link is a directory, not a release link: run migrate.sh first"
    fi
    ln -sfn "releases/$name/$release" "$link.new"
    mv -T "$link.new" "$link"
    echo "$name: now $release"
}

prune () {
    name=$1
    current=$(current_release "$name")
    count=$(list_releases "$name" | wc -l)
    list_releases "$name" | head -n "$((count > KEEP ? count - KEEP : 0))" | while read -r old; do
        [ "$old" = "$current" ] && continue
        rm -rf "${RELEASES:?}/$name/$old"
        echo "$name: removed old release $old"
    done
}

# --- перезапуск mail-server без потери выполняющихся рассылок ---------------
#
# Версии mail-server до «Resume mailings after a server restart» при запуске
# переводят все RUNNING-рассылки в PAUSED. Поэтому перед перезапуском
# запоминаются выполняющиеся рассылки, а после — те из них, что оказались на
# паузе, запускаются снова (PUT /mailings/<id> {"state": 2}). Новые версии
# продолжают их сами, тогда здесь ничего не делается.

api_url () {
    if [ -n "${MAIL_SERVER_URL:-}" ]; then
        echo "$MAIL_SERVER_URL"
        return
    fi
    node -e '
        const fs = require("fs");
        let server = {};
        try {
            server = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).server || {};
        } catch (e) {}
        const host = !server.host || server.host === "0.0.0.0" ? "127.0.0.1" : server.host;
        console.log(`http://${host}:${server.port || 8000}`);
    ' "$ETC/mail-server.json"
}

# api <метод> <путь> [тело] — печатает ответ, код возврата 1 при ошибке
api () {
    node -e '
        const [method, url, body] = process.argv.slice(1);
        fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: body || undefined,
            signal: AbortSignal.timeout(5000)
        }).then(async response => {
            const text = await response.text();
            console.log(text);
            process.exit(response.ok ? 0 : 1);
        }).catch(() => process.exit(1));
    ' "$1" "$(api_url)$2" "${3:-}"
}

running_mailings () {
    api GET /mailings 2>/dev/null | node -e '
        let data = "";
        process.stdin.on("data", chunk => { data += chunk; });
        process.stdin.on("end", () => {
            try {
                const list = JSON.parse(data).data || [];
                console.log(list.filter(m => m.state === 2).map(m => m.id).join(" "));
            } catch (e) {}
        });
    '
}

mailing_state () {
    api GET "/mailings/$1" 2>/dev/null | node -e '
        let data = "";
        process.stdin.on("data", chunk => { data += chunk; });
        process.stdin.on("end", () => {
            try { console.log(JSON.parse(data).data.state); } catch (e) {}
        });
    '
}

restart_mail_server () {
    running=$(running_mailings || :)
    [ -z "$running" ] || echo "running mailings: $running"
    $SYSTEMCTL try-restart mail-server 9>&-
    [ -n "$running" ] || return 0

    # ждём, пока API ответит (сервер переводит рассылки в паузу до начала работы)
    tries=30
    until api GET /mailings >/dev/null 2>&1; do
        tries=$((tries - 1))
        [ "$tries" -gt 0 ] || { echo "mail-server API not responding, start mailings by hand: $running" >&2; return 1; }
        sleep 1
    done
    for id in $running; do
        state=$(mailing_state "$id")
        if [ "$state" = 3 ]; then
            if api PUT "/mailings/$id" '{"state":2}' >/dev/null; then
                echo "mailing #$id: resumed"
            else
                echo "mailing #$id: could not resume, start it by hand" >&2
            fi
        else
            echo "mailing #$id: state $state, nothing to do"
        fi
    done
}

restart_service () {
    name=$1
    [ -n "$RESTART" ] || return 0
    service=$(service_of "$name")
    [ -n "$service" ] || return 0
    if [ "$service" = mail-server ]; then
        restart_mail_server
    else
        $SYSTEMCTL try-restart "$service" 9>&-
    fi
}

# --- команды ----------------------------------------------------------------

update_project () {
    name=$1 ref=$2
    mirror=$BUILD_HOME/repos/$name.git
    log "$name: fetch $ref"
    if [ -d "$mirror" ]; then
        if [ -n "${REPO_BASE:-}" ]; then
            as_build "git --git-dir='$mirror' remote set-url origin '$REPO_BASE/$name$REPO_SUFFIX'"
        fi
        as_build "git --git-dir='$mirror' fetch -q --prune --tags origin '+refs/heads/*:refs/heads/*'"
    else
        as_build "mkdir -p '$BUILD_HOME/repos' && git clone -q --bare \
            '${REPO_BASE:-https://github.com/Etersoft}/$name$REPO_SUFFIX' '$mirror'"
    fi
    commit=$(as_build "git --git-dir='$mirror' rev-parse --verify -q '$ref^{commit}'") ||
        die "$name: unknown ref $ref"
    short=$(echo "$commit" | cut -c1-10)
    release=$(date +%Y%m%d-%H%M%S)-$short
    dir=$RELEASES/$name/$release

    log "$name: build $release ($(as_build "git --git-dir='$mirror' log --oneline -1 '$commit'"))"
    install -d -o "$BUILD_USER" -g "$BUILD_USER" -m 755 "$RELEASES/$name"
    tmp=$dir.tmp
    rm -rf "$tmp"
    # при ошибке сборки недособранный каталог удаляется, ссылка не меняется
    trap 'rm -rf "$tmp"' EXIT
    as_build "mkdir '$tmp' && git --git-dir='$mirror' archive '$commit' | tar -x -C '$tmp'"
    build_project "$name" "$tmp"
    link_config "$name" "$tmp"
    echo "$commit" > "$tmp/REVISION"
    # код принадлежит mailing-build, остальные только читают
    chown -R -h "$BUILD_USER:$BUILD_USER" "$tmp"
    chmod -R u+rwX,go+rX,go-w "$tmp"
    if runuser -u "$APP_USER" -- test -w "$tmp"; then
        die "$name: $APP_USER can write to the release, check owners of $RELEASES"
    fi
    mv -T "$tmp" "$dir"
    trap - EXIT

    switch_to "$name" "$release"
    restart_service "$name"
    prune "$name"
}

rollback_project () {
    name=$1
    current=$(current_release "$name")
    [ -n "$current" ] || die "$name: no current release"
    previous=$(list_releases "$name" | awk -v cur="$current" '$0 == cur { print prev; exit } { prev = $0 }')
    [ -n "$previous" ] || die "$name: no release before $current"
    log "$name: rollback $current -> $previous"
    switch_to "$name" "$previous"
    restart_service "$name"
}

show_releases () {
    for name in "$@"; do
        current=$(current_release "$name")
        echo "$name:"
        list_releases "$name" | while read -r release; do
            [ "$release" = "$current" ] && mark='*' || mark=' '
            echo "  $mark $release"
        done
    done
}

check_project () {
    for project in $PROJECTS; do
        [ "$1" = "$project" ] && return 0
    done
    die "unknown project $1 (expected: all $PROJECTS)"
}

RESTART=1
ACTION=update
while [ $# -gt 0 ]; do
    case "$1" in
        --no-restart) RESTART= ;;
        --rollback) ACTION=rollback ;;
        --list) ACTION=list ;;
        -h|--help) usage ;;
        -*) echo "Unknown option: $1" >&2; usage 1 ;;
        *) break ;;
    esac
    shift
done

[ "$(id -u)" = 0 ] || die "run as root"
id "$BUILD_USER" >/dev/null 2>&1 || die "no user $BUILD_USER: run install.sh or migrate.sh"

if [ "$ACTION" = list ]; then
    if [ $# -gt 0 ]; then check_project "$1"; show_releases "$1"; else show_releases $PROJECTS; fi
    exit 0
fi

[ $# -ge 1 ] || usage 1
target=$1
ref=${2:-master}
if [ "$target" = all ]; then
    [ "$ACTION" = update ] || die "--rollback needs one project"
    targets=$PROJECTS
else
    check_project "$target"
    targets=$target
fi

# одна выкладка за раз
# дескриптор не передаётся службам: см. 9>&- у systemctl
exec 9>/run/eterfund-mail-update.lock
flock -n 9 || die "another update.sh is running"

for name in $targets; do
    if [ "$ACTION" = rollback ]; then
        rollback_project "$name"
    else
        update_project "$name" "$ref"
    fi
done
log "Done"
