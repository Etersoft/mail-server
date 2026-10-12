# Mail-server

[Read this readme in English.](./README.md)

Состоит из двух частей: сервер на Node.js и клиент на TypeScript + react-redux. 

## Установка

Нужны Node.js 22.12 или новее и Redis.

```
$ npm ci
$ npm run server:build
$ cp templates/confirm-subscription.hbs.example templates/confirm-subscription.hbs
```

Вероятнее всего, вы захотите изменить некоторые значения в конфигурации.  
Создайте файл `config.json` и переопределите нужные значения из `config.default.json`.

**Пример конфигурации файла `config.json`:** 


```js
}
//конфигурация клиента
  "client": {
    "apiUrl": "/api",
    "imageServiceUrl": "/images", //URL сервера для загрузки вложений, см. https://gitlab.eterfund.ru/ipfs-images/ipfs-images
    "webpack": {
      "port": 8080,
      "publicPath": "http://localhost:8080/"
    }
  },
//конфигурация сервера  
  "server": {
    "corsWhitelist": ["https://examplehost.com"], //массив URL-адресов для CORS
    "fakeSender": false, //предназначен для отладки сервера, при установке значения true вместо отправки рассылки выводит информацию о ней в консоль
    "logLevel": "silly", // error, warn, info, verbose, debug, silly
    "mail": {//параметры письма рассылки
      "from": "someuser@example.com",
      "listIdDomain": "some.domain"
    },
    //параметры паузы в рассылке (для работы необходимо указать оба поля)
    "maxEmailsWithoutPause": 3, //количество успешно отправленных писем перед паузой в рассылке
    "pauseDuration": 10, //длительность паузы в секундах

    "port": 8020,
    "redis": {
      "db": 0,//номер БД Redis
      "pool": {//конфигурация пула соединений Redis
        "min": 1, //минимальное количество соединений
        "max": 5 //максимальное количество соединений
      },
      "host": "localhost", // или "url": "redis://user:password@host:6379/0"
      "port": 6379,
      "password": "..." // необязательно
    },
    "smtp": {//параметры smtp-сервера
      "host": "localhost",
      "port": 9025
    },
    "subscription": {//параметры подписок на расслыки
      "requestTTL": 1209600, //время жизни запроса на подписку в redis
      "subject": "Подписка на рассылку" //тема письма при запросе подписки на рассылку
    }
  }
}

```

После этого можно запускать сервер:
```
$ npm run server:start
```
или
```
$ node server/dist/src/index.js
```

### API для mail-sorter

`POST /mailings/unsubscribe` с телом `{"email": "..."}` исключает адрес из всех рассылок
без кода подтверждения и возвращает `{"removed": <число рассылок>}`. Используется драйвером
базы `mail-server` в [mail-sorter](https://github.com/Etersoft/mail-sorter). Как и остальной
API, работает без аутентификации: сервер не должен быть доступен снаружи.

### Разработка

- `npm run typecheck`, `npm run lint`;
- `npm test` — сборка и тесты сервера (`node:test`). Тесты, которым нужен Redis, запускаются
  только при заданном `TEST_REDIS_URL`; эта база очищается, поэтому нужен отдельный экземпляр,
  например `docker run -d -p 127.0.0.1:16379:6379 redis:7-alpine` и
  `TEST_REDIS_URL=redis://127.0.0.1:16379/1 npm test`;
- `npm run client:watch` — webpack dev server для клиента.

### Установка клиента

Если клиент тоже нужен — при необходимости измените шаблон письма по умолчанию
`client/src/email-template.html` перед сборкой.

Далее запустите сборку:
```
$ npm run client:build
```

И настройте ваш веб-сервер на раздачу содержимого каталога `client/public`.


### Принцип работы

Для хранения информации о рассылках используется [redis](https://redis.io/).
Рассылка имеет следующие атрибуты:
- ID;
- Название;
- Состояние (NEW = 1, RUNNING = 2, PAUSED = 3, FINISHED = 4, ERROR = 5);
- Заголовки (уникальным для каждой рассылки является заголовок `List-Id`. Он генерируется  
  автоматически из времени создания рассылки в формате 'YYYYMMDD', id рассылки и параметра `listIdDomain`.  
  Необходим для просмотра статистики по рассылкам.);
- Список адресатов;
- Количество уже обработанных адресатов.


##  ![AGPL](https://www.gnu.org/graphics/agplv3-88x31.png)Лицензия 
См. файл LICENSE.