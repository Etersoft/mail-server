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

  Итог каждого запуска mail-sorter записывает в Redis; веб-клиент показывает его
  под списком рассылок («Разбор ответов»: последний запуск, письма по типам,
  исключённые и отписанные адреса, ошибки) и предупреждает, если успешного
  запуска не было `server.sorterStatusMaxAge` секунд (по умолчанию 2 часа).
  API: `GET /sorter/status`.
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
nginx для веб-клиента и публичных страниц подписки, локальный Redis; почта
уходит через почтовый сервер организации (`deploy/lxc/install.sh`, пошаговое
задание — в README).

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
    "auth": { "required": true },      // ключи API: false (по умолчанию) — без ключа пропускать и писать в журнал
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
    "sorterStatusMaxAge": 7200,        // необязательно: предупреждать, если mail-sorter не отработал успешно за это время (с)
    "redis": {
      "host": "localhost",             // или "url": "redis://user:password@host:6379/0"
      "port": 6379,
      "db": 0,
      "password": "...",               // необязательно
      "pool": { "min": 1, "max": 5 },  // размер пула соединений
      "prefixes": {}                   // необязательно: префиксы ключей, см. RedisMailingRepository
    },
    "smtp": {                          // почтовый сервер организации
      "host": "mail.example.com",
      "port": 587,
      "secure": false,                 // необязательно: true — сразу TLS (порт 465), иначе STARTTLS
      "auth": { "user": "noreply@example.com", "pass": "%{SMTP_PASSWORD}" },  // необязательно
      "name": "mailing.example.com"    // необязательно: имя в EHLO, см. ниже
    },
    "subscription": {
      "requestTTL": 1209600,           // время жизни запроса на подписку, секунды
      "url": "https://subscribe.example.com",  // страницы subscription-facade, для ссылки подтверждения
      "subject": "Подписка на рассылку",  // тема письма с подтверждением
      "replyTo": "support@example.com" // необязательно
    }
  }
}
```

`%{ИМЯ}` в любой строке заменяется переменной окружения `ИМЯ` (если она не
задана, сервер не запустится): так пароль SMTP можно хранить не в `config.json`.
Имя в EHLO по умолчанию — имя системы, если это полное доменное имя; иначе
nodemailer передаёт `[127.0.0.1]`, за что некоторые релеи и спам-фильтры
снижают оценку, — тогда задайте `smtp.name`.

Значения `client.*` встраиваются в клиент при сборке — после их изменения
клиент нужно пересобрать. `client.imageServiceUrl` — сервис для картинок,
вставляемых в редакторе (`POST <url>/ul` с файлом возвращает `{"id": ...}`,
картинка затем доступна по `<url>/dl/<id>/<имя>`), например
[ipfs-images](https://gitlab.eterfund.ru/ipfs-images/ipfs-images).

## Рассылки

У рассылки есть название, тема, HTML-текст, необязательные From и Reply-To, список
получателей и состояние: NEW = 1, RUNNING = 2, PAUSED = 3, FINISHED = 4,
ERROR = 5. Выполняющуюся рассылку можно приостановить и продолжить, завершённую —
перезапустить с начала. Рассылки, которые выполнялись при остановке сервера, при
следующем запуске продолжаются; рассылка на автоматической паузе
(`maxEmailsWithoutPause`) продолжится в сохранённое время (`autoResumeAt`), в том
числе после перезапуска.

Каждая рассылка получает уникальный заголовок `List-Id` вида
`<YYYYMMDD-<id>.eterpost.<listIdDomain>>` (RFC 2919), у писем также есть
`Precedence: bulk`. По `List-Id` mail-sorter относит недоставки к рассылке.
Рассылки, созданные раньше, сохраняют прежний вид `<YYYYMMDD-<id>@<listIdDomain>>`;
новый вид mail-sorter понимает начиная с «Read List-Id from the raw header».

Заголовок `List-Unsubscribe` (`server.mail.listUnsubscribe`) добавляется только в
рассылки с `listUnsubscribe: true` (по умолчанию включён, у рассылки его можно
выключить). По этому
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
есть выгрузка в CSV). Адреса, которые mail-sorter уже исключил из рассылки из-за
ошибок доставки, остаются в этом списке с пометкой «исключён» (`excluded: true`,
в CSV — четвёртая колонка). У каждой ошибки указаны время (`date`, пятая
колонка CSV) и рассылка, в которой она возникла (`mailingId`, шестая колонка;
у ошибок, записанных до появления этого поля, его нет). «Повтор рассылки»
создаёт новую рассылку с тем же текстом для этих адресов, кроме исключённых.

Ошибки SMTP при отправке: если сервер отклонил получателя на `RCPT TO`, в
статистику адреса записывается статус доставки, а рассылка идёт дальше со
следующего получателя. Многие релеи проверяют адрес сразу и отказывают именно
здесь, тогда уведомление о недоставке (DSN) до mail-sorter не дойдёт. Отказ 5xx —
постоянная ошибка (адрес попадает в ошибки доставки и отсеивается из новых
рассылок), 4xx — временная (`temporaryFailureCount`, как считает mail-sorter).
Прочие временные ошибки (4xx на `MAIL FROM` или `DATA`, сбои соединения)
повторяются после пауз `sendRetryDelays`. Остальные ошибки (например, письмо
отклонено на `DATA`) или исчерпанные повторы переводят рассылку в ERROR; после
повторного запуска она продолжится с того же получателя.

## Подписка и отписка

Личные коды назначаются всем получателям, когда рассылка создаётся с
«возможностью подписки через API» (`openForSubscription`) или она включается
позже (`PUT /mailings/:id`),
получателям, добавленным позже при включённой подписке, и всем, кто подписался
через API. Подписка через subscription-facade:

1. Сайт вызывает `POST /mailings/:id/requestSubscription` с
   `{"email", "name", "periodicDate" | "schedule", "extraData"}`.
2. mail-server отправляет письмо с подтверждением по шаблону
   `templates/confirm-subscription.hbs` (контекст: `confirmUrl`, `subscribeUrl`,
   `mailing`, `subscriptionRequest.email`, `subscriptionRequest.code`, `name`,
   `alreadySubscribed`). Ссылка в нём, `{{confirmUrl}}`, ведёт на
   subscription-facade: `<server.subscription.url>/subscribe?code=...&email=...&mailingId=...`,
   адрес в ней закодирован для URL. Если `server.subscription.url` не задан,
   сервер при запуске пишет ошибку в журнал, а `confirmUrl` пуст.
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

### Ключи API

Запрос к API передаёт ключ в заголовке `Authorization: Bearer <ключ>` (или
`X-API-Key: <ключ>`). У каждого ключа есть имя — кто им пользуется (`front`,
`subscription-facade`, `site-example`…); сервер хранит в Redis только его
sha256, сам ключ выводится один раз при создании. Неизвестный ключ — всегда
`401`. Запрос без ключа при `server.auth.required: false` (по умолчанию)
пропускается, и раз в 10 минут на адрес и метод сервер пишет в журнал
`Request without API key: …` — так перед включением `true` можно найти всех,
кому ещё нужен ключ; при `true` такой запрос получает `401`. Без ключа всегда
открыты только `/openapi.json` и `/docs/`.

Ключи создаются на сервере командой (нужен доступ к Redis из конфига; если в
конфиге есть `%{ИМЯ}`, передайте те же переменные окружения):

```
node server/dist/src/apiKeysCli.js add site-example      # вывести новый ключ
node server/dist/src/apiKeysCli.js add front --proxy     # ключ обратного прокси
node server/dist/src/apiKeysCli.js list                  # имя, тип, создан, последнее использование
node server/dist/src/apiKeysCli.js revoke site-example
```

Ключ с `--proxy` — для фронта, через который в веб-клиент входят люди: фронт
проверяет пользователя, добавляет к запросу свой ключ и заголовок
`X-Remote-User` с его именем. Этому заголовку сервер верит только вместе с
ключом прокси. Изменяющие запросы (всё, кроме `GET`) записываются в журнал с
именем ключа и пользователя и списком полей тела (без текста письма и адресов):
`PUT /mailings/5 by ivan via front from 10.0.0.7: state=running`. Свои ключи
нужны и subscription-facade (`apiKey` в его конфиге), и mail-sorter
(`apiKey` в параметрах драйвера `mail-server`).

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
