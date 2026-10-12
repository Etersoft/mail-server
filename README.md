# Mail-server

[Читать readme на русском языке.](./README.ru.md)

It consists of two parts: one is server on Node.js and a client on TypeScript + react-redux. 

## Installation

Node.js 22.12 or newer and Redis are required.

```
$ npm ci
$ npm run server:build
$ cp templates/confirm-subscription.hbs.example templates/confirm-subscription.hbs
```

You most likely want to change some values ​​in the configuration.
Create a file `config.json` and override the desired values ​​from `config.default.json`.

**Configuration example for `config.json`:** 


```js
}
//client configuration
  "client": {
    "apiUrl": "/api",
    "imageServiceUrl": "/images", //URL of the server to download attachments, see: https://gitlab.eterfund.ru/ipfs-images/ipfs-images
    "webpack": {
      "port": 8080,
      "publicPath": "http://localhost:8080/"
    }
  },
//server configuration  
  "server": {
    "corsWhitelist": ["https://examplehost.com"], //array of URLs for CORS
    "fakeSender": false, //intended for server debugging, when set to true instead of sending a mailing, displays information about it to the console
    "logLevel": "silly", // error, warn, info, verbose, debug, silly
    "mail": {//mailing options
      "from": "someuser@example.com",
      "listIdDomain": "some.domain"
    },
    //parameters of the pause in the mailing (for operation, you must specify both fields)
    "maxEmailsWithoutPause": 3, //the number of successfully sent letters before the pause in the mailing 
    "pauseDuration": 10, //pause duration in seconds

    "port": 8020,
    "redis": {
      "db": 0,//Redis database number
      "pool": {//Redis connection pool configuration
        "min": 1, //minimum number of connections
        "max": 5 //maximum number of connections
      },
      "host": "localhost", // or "url": "redis://user:password@host:6379/0"
      "port": 6379,
      "password": "..." // optional
    },
    "smtp": {//smtp-server settings
      "host": "localhost",
      "port": 9025
    },
    "subscription": {//mailing subscription settings
      "requestTTL": 1209600, //the lifetime of the subscription request in redis
      "subject": "Subscription to mailing" //subject of the letter when subscribing to a mailing
    }
  }
}

```

After that you can start the server:
```
$ npm run server:start
```
or
```
$ node server/dist/src/index.js
```

### API for mail-sorter

`POST /mailings/unsubscribe` with `{"email": "..."}` removes the address from all
mailings without a confirmation code and returns `{"removed": <number of mailings>}`.
It is used by the `mail-server` database driver of
[mail-sorter](https://github.com/Etersoft/mail-sorter). Like the rest of the API, it has no
authentication: the server must not be reachable from the outside.

### Development

- `npm run typecheck`, `npm run lint`;
- `npm test` — build and run server tests (`node:test`). Tests that need Redis run only when
  `TEST_REDIS_URL` is set; that database is flushed, so use a separate instance, e.g.
  `docker run -d -p 127.0.0.1:16379:6379 redis:7-alpine` and
  `TEST_REDIS_URL=redis://127.0.0.1:16379/1 npm test`;
- `npm run client:watch` — webpack dev server for the client.

### Client installation

If you also need a client, edit the default letter template
`client/src/email-template.html` before building it, if needed.

Next, run the build:
```
$ npm run client:build
```

And configure your web server to distribute the contents of the `client/public` directory.


### Principles of operation

[Redis](https://redis.io/) is used as a database to store information about mailings.

Mailing has attributes:
- ID;
- Name;
- State (NEW = 1, RUNNING = 2, PAUSED = 3, FINISHED = 4, ERROR = 5);
- Headers (The header `List-Id`is unique for each mailing. It is generated  
  automatically from the time the mailing was created in the format 'YYYYMMDD', mailing id and the parameter `list Id Domain`. Required to view mailing statistics.);
- Receivers list;
- The number of already processed receivers;


##  ![AGPL](https://www.gnu.org/graphics/agplv3-88x31.png)License 
Look through the file LICENSE.