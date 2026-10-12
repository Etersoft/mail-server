# Тестовый стенд: mail-server, subscription-facade, mail-sorter

Поднимает в docker все три проекта вместе с Redis и локальным почтовым
сервером [GreenMail](https://greenmail-mail-test.github.io/greenmail/)
(SMTP 3025, IMAP 3143; принимает почту на любые адреса, ящики создаются при
первом входе с любым паролем) и прогоняет сквозные тесты.

Каждый проект собирается по своему `Dockerfile`: mail-server — из этого
репозитория, subscription-facade и mail-sorter — из их git-репозиториев
(ветка master на GitHub). Чтобы проверить локальные копии, задайте каталоги
(пути относительно каталога `stand`):

```
SUBSCRIPTION_FACADE_SRC=../../subscription-facade MAIL_SORTER_SRC=../../mail-sorter ./run.sh
```

Можно указать и другой git-адрес или ветку, например
`MAIL_SORTER_SRC=https://github.com/Etersoft/mail-sorter.git#my-branch`.

## Запуск

```
./run.sh          # сборка, тесты, удаление стенда
./run.sh --keep   # то же, но стенд остаётся запущенным
```

Нужен только docker с плагином compose. Наружу (на 127.0.0.1) открыты:

- веб-интерфейс mail-server — http://127.0.0.1:18100/ (`STAND_UI_PORT`);
- страницы подписки — http://127.0.0.1:18101/ (`STAND_FACADE_PORT`).

Остановить оставленный стенд (в каталоге `stand`): `docker compose --profile tools down -v`.

## Что проверяется

Этап 1 (`e2e/1-mailing.test.js`):

1. клиент mail-server отдаётся nginx, `/api` проксируется на сервер;
2. рассылка на два адреса: персональная тема и текст (Handlebars),
   заголовки `List-Id` и `Precedence: bulk`, состояние FINISHED;
3. запрос подписки через API, письмо с кодом, подписка и отписка через
   subscription-facade (и отказ при неверном коде);
4. в ящик `noreply@example.com` приходят уведомление о недоставке (DSN) для
   одного из получателей и письмо от человека.

Затем один раз запускается mail-sorter (`config/mail-sorter.json`,
драйвер базы `mail-server`).

Этап 2 (`e2e/2-after-sorter.test.js`): ошибка доставки учтена в статистике
рассылки (Redis), адрес исключён из рассылок через
`POST /mailings/unsubscribe`, письмо человека переслано на
`admin@example.com`, обработанные письма помечены прочитанными.

## Ручная работа со стендом

```
docker compose run --rm mail-sorter --dry   # mail-sorter без изменений
docker compose run --rm e2e 1-mailing.test.js
docker compose logs -f mail-server
```

Письма можно читать любым IMAP-клиентом, подключившись к контейнеру `mail`
(порты не опубликованы; при необходимости добавьте `ports` в `compose.yml`).
