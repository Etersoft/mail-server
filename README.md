# mail-server

[Читать на русском](./README.ru.md)

Bulk mailing service: an HTTP API server on Node.js (mailings are stored in
[Redis](https://redis.io/), letters are sent over SMTP) and a web client on
React + Redux for creating and running mailings.

## Related projects

mail-server is the core of a small system. Two more projects work on top of it:

| Project | What it does |
|---|---|
| **mail-server** (this one) | Mailings and receivers, sending, statistics, subscription API, web client |
| [subscription-facade](https://github.com/Etersoft/subscription-facade) | Public HTML pages for "subscribe" / "unsubscribe" links in letters; calls the mail-server API |
| [mail-sorter](https://github.com/Etersoft/mail-sorter) | Reads the `noreply@` mailbox over IMAP: bounces (DSN), unsubscribe requests, autoreplies, letters from people |

```
   operator                      people (links in letters)
      |                                    |
      v                                    v
  web client --/api--> mail-server <-- subscription-facade
                        |   |   ^
             mailings,  |   |   |  POST /mailings/unsubscribe
             statistics v   |   |
                     Redis  |  mail-sorter <--IMAP-- noreply@ mailbox
                       ^    |   |                          ^
                       |    | SMTP                         | bounces (DSN),
                       +----|---+ statistics               | replies
                            v                              |
                        receivers --------------------------+
```

How they fit together:

- **subscription-facade** needs only the mail-server URL (`backend` in its
  `config.json`). Links in letters point to it, see
  [Subscribe and unsubscribe](#subscribe-and-unsubscribe). It must be reachable
  from the internet; mail-server itself must not be.
- **mail-sorter** is started on schedule (e.g. hourly by cron) and reads the
  mailbox that receives replies to mailings, usually the address from
  `server.mail.from`. For the integration set in its `config.json`:
  - `redis` — the same Redis server, database and `prefixes` as mail-server:
    bounces are counted per mailing (by the `List-Id` header) and per address;
    the web client shows them as "delivery errors";
  - `database: { "type": "mail-server", "options": { "backend": "<mail-server URL>" } }` —
    addresses with permanent errors (or more than `maxTemporaryFailures`
    temporary ones) are removed from all mailings via `POST /mailings/unsubscribe`,
    senders of unsubscribe letters only from mailings with `listUnsubscribe`;
  - `forwardTo` — where to forward letters from people.
- All three projects have a `Dockerfile`; the [test stand](#test-stand) runs
  them together.

## Quick start with Docker

```
$ docker build --target server -t mail-server .
$ docker build --target client -t mail-server-client .   # static client for nginx
$ docker run -d -v $PWD/config.json:/app/config.json -p 8000:8000 mail-server
```

The server reads `/app/config.json` on top of `config.default.json` and the
subscription letter template from `/app/templates/confirm-subscription.hbs`
(the example template is used if the file is not mounted). The client image is
nginx with the built client; proxy `/api/` to the server, e.g.:

```nginx
location /api/ { proxy_pass http://mail-server:8000/; }
location / { try_files $uri /index.html; }
```

### Test stand

[`stand/`](stand/README.md) runs all three projects in docker compose together
with Redis and a local mail server (GreenMail) and checks the whole chain:
sending, subscription through subscription-facade, bounce processing by
mail-sorter. subscription-facade and mail-sorter are built from their git
repositories by their own Dockerfiles; local copies can be used instead:

```
$ stand/run.sh
$ SUBSCRIPTION_FACADE_SRC=../../subscription-facade MAIL_SORTER_SRC=../../mail-sorter stand/run.sh
```

## Installation without Docker

Node.js 22.12 or newer and Redis are required.

```
$ npm ci
$ npm run server:build
$ cp templates/confirm-subscription.hbs.example templates/confirm-subscription.hbs
$ npm run server:start            # or: node server/dist/src/index.js
```

Client (optional):

```
$ npm run client:build            # the result is in client/public
```

Serve `client/public` with a web server and proxy `client.apiUrl` (`/api` by
default) to mail-server.

### Deployment without Docker

[`deploy/lxc/`](deploy/lxc/README.md) installs all three projects into an LXC
container or a VM with ALT Linux: systemd services, an hourly timer for
mail-sorter, nginx for the web client and the public subscription pages, local
Redis and postfix (`deploy/lxc/install.sh`; the guide is in Russian).

## Configuration

Create `config.json` in the project root; it is merged over
[`config.default.json`](config.default.json). The file is plain JSON (the
comments below are for explanation only):

```js
{
  "client": {
    "apiUrl": "/api",                  // where the client sends API requests
    "imageServiceUrl": "/images",      // image upload service for the editor (see below)
    "staticUrl": "/",                  // <base href> of the client
    "webpack": { "port": 8080, "publicPath": "http://localhost:8080/" }  // dev server
  },
  "server": {
    "port": 8000,
    "host": "127.0.0.1",               // optional: listen address (all interfaces by default)
    "logLevel": "verbose",             // error, warn, info, verbose, debug
    "corsWhitelist": ["https://admin.example.com"],  // allowed origins for the API
    "fakeSender": false,               // true: print letters to the console instead of sending
    "mail": {
      "from": "noreply@example.com",   // service address: envelope sender (bounces) and default From
      "listIdDomain": "example.com",   // domain part of the List-Id header
      "listUnsubscribe": "<mailto:noreply+unsubscribe@example.com>"  // optional List-Unsubscribe header
    },
    "maxEmailsWithoutPause": 1000,     // optional: pause the mailing after this many letters...
    "pauseDuration": 600,              // ...for this many seconds (both must be set)
    "sendRetryDelays": [10, 60, 300],  // optional: pauses (s) before retrying a temporary SMTP error
    "redis": {
      "host": "localhost",             // or "url": "redis://user:password@host:6379/0"
      "port": 6379,
      "db": 0,
      "password": "...",               // optional
      "pool": { "min": 1, "max": 5 },  // connection pool size
      "prefixes": {}                   // optional key prefixes, see RedisMailingRepository
    },
    "smtp": {                          // SMTP relay without authentication
      "host": "localhost",
      "port": 25
    },
    "subscription": {
      "requestTTL": 1209600,           // lifetime of a subscription request, seconds
      "subject": "Подписка на рассылку",  // subject of the confirmation letter
      "replyTo": "support@example.com" // optional
    }
  }
}
```

`client.*` values are built into the client, so rebuild it after changing them.
`client.imageServiceUrl` is a service for images inserted in the editor
(`POST <url>/ul` with a file returns `{"id": ...}`, the image is then available
at `<url>/dl/<id>/<name>`), for example
[ipfs-images](https://gitlab.eterfund.ru/ipfs-images/ipfs-images).

## Mailings

A mailing has a name, subject, HTML text, optional From and Reply-To, a list of receivers
and a state: NEW = 1, RUNNING = 2, PAUSED = 3, FINISHED = 4, ERROR = 5. A running
mailing can be paused and continued; a finished one can be restarted from the
beginning. If the server stops while a mailing is running, it is marked PAUSED on
the next start.

Every mailing gets a unique `List-Id` header `<YYYYMMDD-<id>@<listIdDomain>>`;
letters also have `Precedence: bulk`. mail-sorter uses `List-Id` to attribute
bounces to a mailing.

The `List-Unsubscribe` header (`server.mail.listUnsubscribe`) is added only to
mailings with `listUnsubscribe: true` (off by default for new mailings; mailings
created before this option keep it on). Mail programs show an "Unsubscribe"
button by this header. A letter sent to its address unsubscribes the sender only
from mailings with this option, not from the rest.

Letters are sent as HTML with a plain text alternative generated from it
(images are dropped, links become `text [url]`).

A mailing may set its own `From` (e.g. `Sales <sales@example.com>`). The
envelope sender (Return-Path) and the `Sender` header stay `server.mail.from`,
so bounces still reach the mailbox read by mail-sorter. The `From` domain needs
SPF and DKIM records that allow the mail relay to send for it.

Receivers are added in the web client from a CSV file without a header, one
receiver per line: `email,name,extraData`, where `extraData` is an optional JSON
object, e.g. `ivan@example.com,Ivan,{"city": "Moscow"}`. Invalid addresses and
addresses whose last delivery status was a permanent error (5.x.x) are rejected
when a mailing is created.

### Letter templates

Subject and HTML text are [Handlebars](https://handlebarsjs.com/) templates
rendered for every receiver with the context:

- `receiver.email`, `receiver.name`, `receiver.code` (personal code for
  subscribe/unsubscribe links), `receiver.extraData.*`;
- `mailing.id`, `mailing.name`, `mailing.listId`, `mailing.extraData.*`.

Two helpers insert content from other services:

- `{{external_content "https://example.com/news.html"}}` — GET the URL once per
  mailing run and insert the response;
- `{{external_content_with_receiver_data "https://example.com/personal"}}` — POST
  `receiver.extraData` as JSON for every receiver and insert the response.

If a request fails, the letter is not sent and the mailing goes to the ERROR state.

### Periodic receivers

Receivers who subscribed with a schedule (`periodicDate`) get the letter only on
matching days when the mailing is started: a day of month (`15`; the last day of
a shorter month is used for `31`) or a cron expression for day of month, month
and day of week (`* * 1` — on Mondays). Receivers without a schedule get every
mailing.

### Failed receivers and retry

"Delivery errors" in the web client lists receivers with a delivery status
recorded by mail-sorter after the mailing was created
(`GET /mailings/:id/failed-receivers`, also as CSV). "Retry" creates a new
mailing with the same text for these addresses only.

SMTP errors while sending: a receiver rejected with 5xx at `RCPT TO` gets a
delivery status in its statistics (it appears among delivery errors and is
filtered out of new mailings) and the mailing goes on. Temporary errors (4xx,
connection failures) are retried after the `sendRetryDelays` pauses. Any other
error (e.g. the letter rejected at `DATA`) or retries exhausted put the mailing
into ERROR; started again, it continues with the same receiver.

## Subscribe and unsubscribe

Personal codes are assigned to all receivers when "open for subscription"
(`openForSubscription`) is switched on for a mailing (`PUT /mailings/:id`), to
receivers added later while it is on, and to everyone who subscribed through the
API. The subscription flow with subscription-facade:

1. A site calls `POST /mailings/:id/requestSubscription` with
   `{"email", "name", "periodicDate" | "schedule", "extraData"}`.
2. mail-server sends a confirmation letter from
   `templates/confirm-subscription.hbs` (context: `mailing`,
   `subscriptionRequest.email`, `subscriptionRequest.code`, `name`,
   `alreadySubscribed`). The link in it points to subscription-facade:
   `https://subscribe.example.com/subscribe?mailingId={{mailing.id}}&email={{subscriptionRequest.email}}&code={{subscriptionRequest.code}}`.
3. subscription-facade calls `POST /mailings/:id/subscribe` and shows the result.

An unsubscribe link in the mailing text:

```html
<a href="https://subscribe.example.com/unsubscribe?mailingId={{mailing.id}}&email={{receiver.email}}&code={{receiver.code}}">Unsubscribe</a>
```

`mailing.extraData.textAfterSubscribe` and `textAfterUnsubscribe` (HTML) replace
the default texts on the subscription-facade pages.

## API

All responses are JSON `{"success": true, "data": ...}` or
`{"success": false, "error": "...", "code": "..."}`. Request bodies are JSON.
The API has no authentication: expose only subscription-facade to the internet
and keep mail-server and its web client in a trusted network.

The service describes itself: the OpenAPI 3.1 document is served at
`GET /openapi.json` and interactive Swagger UI at `/docs/` (behind the nginx
from the examples: `/api/openapi.json` and `/api/docs/`). Request body schemas
there are the same ones the server validates requests with; a test checks that
every route is documented.

| Method and path | Description |
|---|---|
| `GET /mailings` | List of mailings |
| `GET /mailings/:id` | Mailing with text and statistics (`?stringState=1` — state as a name) |
| `POST /mailings` | Create: `{name, subject, html, receivers: [{email, name?, extraData?}], from?, replyTo?, openForSubscription?, extraData?}` or clone: `{sourceId}` |
| `PUT /mailings/:id` | Change fields, `receivers`, or `state` (`2`/`"running"` — start, `3`/`"paused"` — pause) |
| `DELETE /mailings/:id` | Delete (not while running) |
| `GET /mailings/:id/receivers` | Receivers, `?limit=N`, `?format=csv` |
| `DELETE /mailings/:id/receivers/:email` | Remove a receiver |
| `GET /mailings/:id/failed-receivers` | Receivers with delivery errors, `?limit=N`, `?format=csv` |
| `POST /mailings/:id/send-test-email` | Send the letter to `{email}` |
| `POST /mailings/create-retry` | New mailing for failed receivers of `{sourceId}` |
| `POST /mailings/:id/requestSubscription` | Subscription request, see above |
| `POST /mailings/:id/subscribe` | Confirm subscription `{email, code}` |
| `POST /mailings/:id/unsubscribe` | Unsubscribe `{email, code}` |
| `POST /mailings/unsubscribe` | Remove `{email}` from all mailings without a code (for mail-sorter), with `listUnsubscribe: true` only from mailings with this option; returns `{removed}` |

## Development

```
$ npm run typecheck && npm run lint
$ npm test                        # build and run server tests (node:test)
$ npm run server:watch-run        # with npm run server:watch in another terminal
$ npm run client:watch            # webpack dev server for the client
```

Tests that need Redis run only when `TEST_REDIS_URL` is set. **That database is
flushed**, so use a separate Redis instance:

```
$ docker run -d --name test-redis -p 127.0.0.1:16379:6379 redis:7-alpine
$ TEST_REDIS_URL=redis://127.0.0.1:16379/1 npm test
```

## ![AGPL](https://www.gnu.org/graphics/agplv3-88x31.png) License

GNU AGPL v3, see [LICENSE](LICENSE).
