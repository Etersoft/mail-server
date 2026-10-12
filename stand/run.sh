#!/bin/sh
# Полный прогон стенда: сборка образов, запуск сервисов, e2e-тесты,
# обработка почты mail-sorter, проверка результата, остановка.
#   ./run.sh         — прогон и удаление стенда
#   ./run.sh --keep  — оставить стенд запущенным (UI: http://127.0.0.1:18100/)
set -e
cd "$(dirname "$0")"

compose () {
    docker compose "$@"
}

cleanup () {
    if [ "$KEEP" != 1 ]; then
        compose --profile tools down -v --remove-orphans >/dev/null 2>&1 || :
    fi
}

KEEP=0
[ "$1" = "--keep" ] && KEEP=1
trap cleanup EXIT

compose --profile tools build
compose up -d --wait redis mail mail-server facade client

echo "=== Stage 1: mailing, subscription, incoming mail"
compose run --rm e2e 1-mailing.test.js

echo "=== mail-sorter"
compose run --rm mail-sorter

echo "=== Stage 2: mail-sorter results"
compose run --rm e2e 2-after-sorter.test.js

echo "=== OK"
if [ "$KEEP" = 1 ]; then
    echo "Stand is running: UI http://127.0.0.1:${STAND_UI_PORT:-18100}/," \
         "facade http://127.0.0.1:${STAND_FACADE_PORT:-18101}/"
    echo "Stop: docker compose -f $(pwd)/compose.yml --profile tools down -v"
fi
