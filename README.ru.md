# mail-server

[Read in English](./README.md)

Сервис массовых рассылок: HTTP API-сервер на Node.js (рассылки хранятся в
[Redis](https://redis.io/), письма отправляются по SMTP) и веб-клиент на
React + Redux для создания и запуска рассылок.

## Связанные проекты

mail-server — основа небольшой системы, поверх него работают ещё два проекта:

| Проект | Назначение |
|---|---|
| **mail-server** (этот) | Рассылки и получатели, отправка, статистика, API подписки, веб-клиент |
| [subscription-facade](https://github.com/Etersoft/subscription-facade) | Публичные HTML-страницы для ссылок «подписаться» / «отписаться» из писем; обращается к API mail-server |
| [mail-sorter](https://github.com/Etersoft/mail-sorter) | Читает ящик `noreply@` по IMAP: уведомления о недоставке (DSN), запросы отписки, автоответы, письма от людей |

```
   оператор                       люди (ссылки из писем)
      |                                    |
      v                                    v
  веб-клиент --/api--> mail-server <-- subscription-facade
                        |   |   ^
             рассылки,  |   |   |  POST /mailings/unsubscribe
            статистика  v   |   |
                     Redis  |  mail-sorter <--IMAP-- ящик noreply@
                       ^    |   |                          ^
                       |    | SMTP                         | недоставки (DSN),
                       +----|---+ статистика               | ответы
                            v                              |
                        получатели -------------------------+
```

Как они связаны:

- **subscription-facade** нужен только адрес mail-server (`backend` в его
  `config.json`). На него ведут ссылки из писем, см.
  [Подписка и отписка](#подписка-и-отписка). Он должен быть доступен из
  интернета, сам mail-server — нет.
- **mail-sorter** запускается по расписанию (например, раз в час из cron) и
  читает ящик, куда приходят ответы на рассылки, — обычно адрес из
  `server.mail.from`. Для совместной работы в его `config.json` указываются:
  - `redis` — тот же сервер Redis, номер базы и `prefixes`, что у mail-server:
    недоставки учитываются по рассылке (по заголовку `List-Id`) и по адресу,
    веб-клиент показывает их как «ошибки доставки»;
  - `database: { "type": "mail-server", "options": { "backend": "<адрес mail-server>" } }` —
    адреса с постоянными ошибками (или с числом временных больше
    `maxTemporaryFailures`) исключаются из всех рассылок через
    `POST /mailings/unsubscribe`, отправители писем с просьбой отписаться —
    только из рассылок с `listUnsubscribe`;
  - `forwardTo` — куда пересылать письма от людей.
- У всех трёх проектов есть `Dockerfile`; [тестовый стенд](#тестовый-стенд)
  запускает их вместе.

## Быстрый запуск в Docker

```
$ docker build --target server -t mail-server .
$ docker build --target client -t mail-server-client .   # статический клиент для nginx
$ docker run -d -v $PWD/config.json:/app/config.json -p 8000:8000 mail-server
```

Сервер читает `/app/config.json` поверх `config.default.json` и шаблон письма
подписки из `/app/templates/confirm-subscription.hbs` (если файл не подложен,
используется пример). Образ клиента — nginx с собранным клиентом; запросы
`/api/` нужно проксировать на сервер, например:

```nginx
location /api/ { proxy_pass http://mail-server:8000/; }
location / { try_files $uri /index.html; }
```

### Тестовый стенд

[`stand/`](stand/README.md) запускает все три проекта в docker compose вместе с
Redis и локальным почтовым сервером (GreenMail) и проверяет всю цепочку:
отправку, подписку через subscription-facade, обработку недоставок mail-sorter.
subscription-facade и mail-sorter собираются по своим Dockerfile из их
git-репозиториев; вместо них можно взять локальные копии:

```
$ stand/run.sh
$ SUBSCRIPTION_FACADE_SRC=../../subscription-facade MAIL_SORTER_SRC=../../mail-sorter stand/run.sh
```

## Установка без Docker

Нужны Node.js 22.12 или новее и Redis.

```
$ npm ci
$ npm run server:build
$ cp templates/confirm-subscription.hbs.example templates/confirm-subscription.hbs
$ npm run server:start            # или: node server/dist/src/index.js
```

Клиент (если нужен):

```
$ npm run client:build            # результат в client/public
```

Каталог `client/public` раздаётся веб-сервером, а `client.apiUrl` (по умолчанию
`/api`) проксируется на mail-server.

### Развёртывание без Docker

[`deploy/lxc/`](deploy/lxc/README.md) — установка всех трёх проектов в
LXC-контейнер или ВМ с ALT Linux: службы systemd, ежечасный таймер mail-sorter,
nginx для веб-клиента и публичных страниц подписки, локальные Redis и postfix
(`deploy/lxc/install.sh`, пошаговое задание — в README).

## Конфигурация

Создайте `config.json` в корне проекта, он накладывается поверх
[`config.default.json`](config.default.json). Это обычный JSON (комментарии
ниже — только для пояснения):

```js
{
  "client": {
    "apiUrl": "/api",                  // куда клиент отправляет запросы к API
    "imageServiceUrl": "/images",      // сервис загрузки картинок для редактора (см. ниже)
    "staticUrl": "/",                  // <base href> клиента
    "webpack": { "port": 8080, "publicPath": "http://localhost:8080/" }  // dev server
  },
  "server": {
    "port": 8000,
    "host": "127.0.0.1",               // необязательно: адрес для приёма соединений (по умолчанию все)
    "logLevel": "verbose",             // error, warn, info, verbose, debug
    "corsWhitelist": ["https://admin.example.com"],  // разрешённые Origin для API
    "fakeSender": false,               // true: печатать письма в консоль вместо отправки
    "mail": {
      "from": "noreply@example.com",   // адрес сервиса: отправитель конверта (возвраты) и From по умолчанию
      "listIdDomain": "example.com",   // домен в заголовке List-Id
      "listUnsubscribe": "<mailto:noreply+unsubscribe@example.com>"  // необязательный List-Unsubscribe
    },
    "maxEmailsWithoutPause": 1000,     // необязательно: после стольких писем рассылка встаёт на паузу...
    "pauseDuration": 600,              // ...на столько секунд (нужны оба параметра)
    "sendRetryDelays": [10, 60, 300],  // необязательно: паузы (с) перед повтором при временной ошибке SMTP
    "redis": {
      "host": "localhost",             // или "url": "redis://user:password@host:6379/0"
      "port": 6379,
      "db": 0,
      "password": "...",               // необязательно
      "pool": { "min": 1, "max": 5 },  // размер пула соединений
      "prefixes": {}                   // необязательно: префиксы ключей, см. RedisMailingRepository
    },
    "smtp": {                          // SMTP-релей без аутентификации
      "host": "localhost",
      "port": 25
    },
    "subscription": {
      "requestTTL": 1209600,           // время жизни запроса на подписку, секунды
      "subject": "Подписка на рассылку",  // тема письма с подтверждением
      "replyTo": "support@example.com" // необязательно
    }
  }
}
```

Значения `client.*` встраиваются в клиент при сборке — после их изменения
клиент нужно пересобрать. `client.imageServiceUrl` — сервис для картинок,
вставляемых в редакторе (`POST <url>/ul` с файлом возвращает `{"id": ...}`,
картинка затем доступна по `<url>/dl/<id>/<имя>`), например
[ipfs-images](https://gitlab.eterfund.ru/ipfs-images/ipfs-images).

## Рассылки

У рассылки есть название, тема, HTML-текст, необязательные From и Reply-To, список
получателей и состояние: NEW = 1, RUNNING = 2, PAUSED = 3, FINISHED = 4,
ERROR = 5. Выполняющуюся рассылку можно приостановить и продолжить, завершённую —
перезапустить с начала. Если сервер остановился во время рассылки, при следующем
запуске она помечается как PAUSED.

Каждая рассылка получает уникальный заголовок `List-Id` вида
`<YYYYMMDD-<id>@<listIdDomain>>`, у писем также есть `Precedence: bulk`. По
`List-Id` mail-sorter относит недоставки к рассылке.

Заголовок `List-Unsubscribe` (`server.mail.listUnsubscribe`) добавляется только в
рассылки с `listUnsubscribe: true` (у новых рассылок по умолчанию выключен,
рассылки, созданные до появления настройки, считаются включёнными). По этому
заголовку почтовые программы показывают кнопку «Отписаться». Письмо на адрес из
заголовка отписывает отправителя только от рассылок с этой настройкой.

Письма уходят в HTML вместе с текстовой версией, построенной из него
(картинки опускаются, ссылки превращаются в `текст [url]`).

У рассылки может быть свой `From` (например, `Отдел продаж <sales@example.com>`).
Отправитель конверта (Return-Path) и заголовок `Sender` остаются
`server.mail.from`, поэтому возвраты по-прежнему приходят в ящик, который
разбирает mail-sorter. Для домена из `From` нужны записи SPF и DKIM, разрешающие
почтовому релею отправлять от его имени.

Получатели добавляются в веб-клиенте из CSV-файла без заголовка, по одному на
строку: `email,имя,extraData`, где `extraData` — необязательный JSON-объект,
например `ivan@example.com,Иван,{"city": "Москва"}`. Некорректные адреса и
адреса, последний статус доставки которых — постоянная ошибка (5.x.x),
отбрасываются при создании рассылки.

### Шаблоны писем

Тема и HTML-текст — шаблоны [Handlebars](https://handlebarsjs.com/), которые
отрисовываются для каждого получателя с контекстом:

- `receiver.email`, `receiver.name`, `receiver.code` (личный код для ссылок
  подписки/отписки), `receiver.extraData.*`;
- `mailing.id`, `mailing.name`, `mailing.listId`, `mailing.extraData.*`.

Два помощника вставляют содержимое из других сервисов:

- `{{external_content "https://example.com/news.html"}}` — GET-запрос один раз
  за запуск рассылки, вставляется ответ;
- `{{external_content_with_receiver_data "https://example.com/personal"}}` —
  POST с `receiver.extraData` в JSON для каждого получателя, вставляется ответ.

Если запрос не удался, письмо не отправляется, а рассылка переходит в состояние
ERROR.

### Периодические получатели

Получатели, подписавшиеся с расписанием (`periodicDate`), получают письмо только
в подходящие дни запуска рассылки: число месяца (`15`; для `31` в коротком месяце
используется последний день) или cron-выражение для числа, месяца и дня недели
(`* * 1` — по понедельникам). Получатели без расписания получают каждую рассылку.

### Ошибки доставки и повторная рассылка

«Ошибки доставки» в веб-клиенте — получатели со статусом доставки, который
mail-sorter записал после создания рассылки (`GET /mailings/:id/failed-receivers`,
есть выгрузка в CSV). «Повтор рассылки» создаёт новую рассылку с тем же текстом
только для этих адресов.

Ошибки SMTP при отправке: если сервер отклонил получателя кодом 5xx на `RCPT TO`,
в статистику адреса записывается статус доставки (адрес попадает в ошибки доставки
и отсеивается из новых рассылок), а рассылка идёт дальше. Временные ошибки (4xx,
сбои соединения) повторяются после пауз `sendRetryDelays`. Прочие ошибки
(например, письмо отклонено на `DATA`) или исчерпанные повторы переводят рассылку
в ERROR; после повторного запуска она продолжится с того же получателя.

## Подписка и отписка

Личные коды назначаются всем получателям, когда для рассылки включается
«возможность подписки через API» (`openForSubscription`, `PUT /mailings/:id`),
получателям, добавленным позже при включённой подписке, и всем, кто подписался
через API. Подписка через subscription-facade:

1. Сайт вызывает `POST /mailings/:id/requestSubscription` с
   `{"email", "name", "periodicDate" | "schedule", "extraData"}`.
2. mail-server отправляет письмо с подтверждением по шаблону
   `templates/confirm-subscription.hbs` (контекст: `mailing`,
   `subscriptionRequest.email`, `subscriptionRequest.code`, `name`,
   `alreadySubscribed`). Ссылка в нём ведёт на subscription-facade:
   `https://subscribe.example.com/subscribe?mailingId={{mailing.id}}&email={{subscriptionRequest.email}}&code={{subscriptionRequest.code}}`.
3. subscription-facade вызывает `POST /mailings/:id/subscribe` и показывает результат.

Ссылка для отписки в тексте рассылки:

```html
<a href="https://subscribe.example.com/unsubscribe?mailingId={{mailing.id}}&email={{receiver.email}}&code={{receiver.code}}">Отписаться</a>
```

`mailing.extraData.textAfterSubscribe` и `textAfterUnsubscribe` (HTML) заменяют
стандартные тексты на страницах subscription-facade.

## API

Все ответы — JSON `{"success": true, "data": ...}` или
`{"success": false, "error": "...", "code": "..."}`. Тела запросов — JSON.
Аутентификации в API нет: в интернет выставляется только subscription-facade, а
mail-server и его веб-клиент должны находиться в доверенной сети.

Сервис самодокументируемый: описание OpenAPI 3.1 отдаётся по `GET /openapi.json`,
интерактивный Swagger UI — на `/docs/` (за nginx из примеров: `/api/openapi.json`
и `/api/docs/`). Схемы тел запросов в нём те же, по которым сервер проверяет
запросы; тест следит, чтобы был описан каждый маршрут.

| Метод и путь | Назначение |
|---|---|
| `GET /mailings` | Список рассылок |
| `GET /mailings/:id` | Рассылка с текстом и статистикой (`?stringState=1` — состояние строкой) |
| `POST /mailings` | Создать: `{name, subject, html, receivers: [{email, name?, extraData?}], from?, replyTo?, openForSubscription?, extraData?}` или скопировать: `{sourceId}` |
| `PUT /mailings/:id` | Изменить поля, `receivers` или `state` (`2`/`"running"` — запуск, `3`/`"paused"` — пауза) |
| `DELETE /mailings/:id` | Удалить (кроме выполняющейся) |
| `GET /mailings/:id/receivers` | Получатели, `?limit=N`, `?format=csv` |
| `DELETE /mailings/:id/receivers/:email` | Удалить получателя |
| `GET /mailings/:id/failed-receivers` | Получатели с ошибками доставки, `?limit=N`, `?format=csv` |
| `POST /mailings/:id/send-test-email` | Отправить письмо на `{email}` |
| `POST /mailings/create-retry` | Новая рассылка по ошибочным адресам рассылки `{sourceId}` |
| `POST /mailings/:id/requestSubscription` | Запрос подписки, см. выше |
| `POST /mailings/:id/subscribe` | Подтвердить подписку `{email, code}` |
| `POST /mailings/:id/unsubscribe` | Отписаться `{email, code}` |
| `POST /mailings/unsubscribe` | Исключить `{email}` из всех рассылок без кода (для mail-sorter), с `listUnsubscribe: true` — только из рассылок с этой настройкой; возвращает `{removed}` |

## Разработка

```
$ npm run typecheck && npm run lint
$ npm test                        # сборка и тесты сервера (node:test)
$ npm run server:watch-run        # вместе с npm run server:watch в другом терминале
$ npm run client:watch            # webpack dev server для клиента
```

Тесты, которым нужен Redis, запускаются только при заданном `TEST_REDIS_URL`.
**Эта база очищается**, поэтому нужен отдельный экземпляр Redis:

```
$ docker run -d --name test-redis -p 127.0.0.1:16379:6379 redis:7-alpine
$ TEST_REDIS_URL=redis://127.0.0.1:16379/1 npm test
```

## ![AGPL](https://www.gnu.org/graphics/agplv3-88x31.png) Лицензия

GNU AGPL v3, см. [LICENSE](LICENSE).
