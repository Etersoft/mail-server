import { requestBodyJsonSchema as addMailingBody } from './controllers/addMailing';
import { requestBodyJsonSchema as createRetryMailingBody } from './controllers/createRetryMailing';
import {
  requestBodyJsonSchema as requestSubscriptionBody
} from './controllers/requestSubscription';
import { requestBodyJsonSchema as sendTestEmailBody } from './controllers/sendTestEmail';
import { requestBodyJsonSchema as subscribeBody } from './controllers/subscribe';
import { requestBodyJsonSchema as unsubscribeBody } from './controllers/unsubscribe';
import { requestBodyJsonSchema as unsubscribeFromAllBody } from './controllers/unsubscribeFromAll';
import { requestBodyJsonSchema as updateMailingBody } from './controllers/updateMailing';


// Описание API в формате OpenAPI 3.1. Схемы тел запросов берутся из контроллеров —
// те же, по которым проверяются запросы, поэтому описание не расходится с проверкой.
// Ответы описаны вручную; тест проверяет, что здесь есть каждый маршрут из routes.ts.

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

function body (schema: object, example?: object) {
  return {
    content: { 'application/json': { schema, ...(example ? { example } : {}) } },
    required: true
  };
}

function ok (data?: object, description = 'Успешно') {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { const: true },
            ...(data ? { data } : {})
          },
          required: ['success']
        }
      }
    }
  };
}

const failure = (description: string) => ({
  description,
  content: { 'application/json': { schema: ref('Error') } }
});

const badRequest = failure('Некорректный запрос: ошибка проверки тела или параметров');
const notFound = failure('Рассылка не найдена');

const mailingId = (name = 'id') => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'integer', minimum: 1 },
  description: 'ID рассылки'
});

const csvList = {
  limit: {
    name: 'limit',
    in: 'query',
    schema: { type: 'integer', minimum: 1 },
    description: 'Вернуть не больше указанного числа записей'
  },
  format: {
    name: 'format',
    in: 'query',
    schema: { enum: ['csv'] },
    description: 'csv — отдать файл CSV вместо JSON'
  }
};

const receiversList = (item: object) => ({
  type: 'object',
  properties: {
    list: { type: 'array', items: item },
    total: { type: 'integer' }
  }
});

function okOrCsv (data: object) {
  const response = ok(data);
  return {
    ...response,
    content: { ...response.content, 'text/csv': { schema: { type: 'string' } } }
  };
}

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'mail-server API',
    version: '0.1.0',
    description:
      'Сервис массовых рассылок. Ответ всегда JSON вида `{success, data}` при успехе ' +
      'или `{success: false, error, code?}` при ошибке.\n\n' +
      'Авторизации нет: сервис рассчитан на работу во внутренней сети, наружу ' +
      'публикуются только маршруты подписки (через subscription-facade).'
  },
  // Относительный адрес: запросы идут туда же, откуда загружен этот документ
  // (например, /api/ за nginx)
  servers: [{ url: '.' }],
  tags: [
    { name: 'mailings', description: 'Рассылки' },
    { name: 'receivers', description: 'Получатели рассылки' },
    { name: 'subscription', description: 'Подписка и отписка (используется subscription-facade)' },
    { name: 'mail-sorter', description: 'Используется mail-sorter' }
  ],
  paths: {
    '/mailings': {
      get: {
        tags: ['mailings'],
        summary: 'Список рассылок',
        responses: {
          200: ok({ type: 'array', items: ref('MailingSummary') })
        }
      },
      post: {
        tags: ['mailings'],
        summary: 'Создать рассылку или скопировать существующую',
        description:
          'Либо полное описание рассылки, либо `{sourceId}` — копия рассылки вместе ' +
          'с получателями. Адреса, отклонённые фильтром (некорректные, с постоянными ' +
          'ошибками доставки), возвращаются в `rejectedReceivers`.',
        requestBody: body(addMailingBody, {
          name: 'Новости для партнёров',
          subject: 'Новости, {{receiver.name}}',
          html: '<p>Здравствуйте, {{receiver.name}}!</p>',
          from: 'Отдел продаж <sales@example.com>',
          replyTo: 'sales@example.com',
          receivers: [{ email: 'partner@example.com', name: 'Партнёр' }]
        }),
        responses: {
          200: ok({
            type: 'object',
            properties: {
              id: { type: 'integer' },
              listId: { type: 'string' },
              rejectedReceivers: { type: 'array', items: ref('ReceiverInput') }
            }
          }),
          400: badRequest,
          404: failure('Рассылка-источник не найдена')
        }
      }
    },
    '/mailings/unsubscribe': {
      post: {
        tags: ['mail-sorter'],
        summary: 'Исключить адрес из всех рассылок',
        description:
          'Без проверки кода. mail-sorter вызывает его для адресов с постоянными ' +
          'ошибками доставки и для запросов отписки, пришедших письмом. С ' +
          '`listUnsubscribe: true` адрес исключается только из рассылок с ' +
          'заголовком List-Unsubscribe (см. поле `listUnsubscribe` рассылки).',
        requestBody: body(unsubscribeFromAllBody, { email: 'bounced@example.com' }),
        responses: {
          200: ok({
            type: 'object',
            properties: {
              removed: { type: 'integer', description: 'Из скольких рассылок удалён адрес' }
            }
          }),
          400: badRequest
        }
      }
    },
    '/mailings/create-retry': {
      post: {
        tags: ['mailings'],
        summary: 'Создать повторную рассылку по адресам с ошибками доставки',
        description: 'Адреса, исключённые mail-sorter (`excluded`), в неё не попадают.',
        requestBody: body(createRetryMailingBody, { sourceId: 1 }),
        responses: {
          200: ok({
            type: 'object',
            properties: { id: { type: 'integer' }, listId: { type: 'string' } }
          }),
          400: badRequest,
          404: failure('Рассылка-источник не найдена')
        }
      }
    },
    '/mailings/{id}': {
      get: {
        tags: ['mailings'],
        summary: 'Рассылка',
        parameters: [
          mailingId(),
          {
            name: 'stringState',
            in: 'query',
            schema: { type: 'string' },
            description: 'Если задан, `state` возвращается названием (RUNNING), а не числом'
          }
        ],
        responses: {
          200: ok(ref('Mailing')),
          400: badRequest,
          404: notFound
        }
      },
      put: {
        tags: ['mailings'],
        summary: 'Изменить рассылку, её получателей или состояние',
        description:
          'Передаются только изменяемые поля. `receivers` заменяет список целиком. ' +
          'Смена `state` запускает (RUNNING), приостанавливает (PAUSED) или ' +
          'перезапускает рассылку; недопустимый переход — ошибка 400.',
        parameters: [mailingId()],
        requestBody: body(updateMailingBody, { state: 'RUNNING' }),
        responses: {
          200: ok({
            type: 'object',
            properties: {
              rejectedReceivers: { type: 'array', items: ref('ReceiverInput') }
            }
          }),
          400: badRequest,
          404: notFound
        }
      },
      delete: {
        tags: ['mailings'],
        summary: 'Удалить рассылку',
        description: 'Выполняющуюся рассылку удалить нельзя.',
        parameters: [mailingId()],
        responses: {
          200: ok(),
          400: badRequest,
          404: notFound
        }
      }
    },
    '/mailings/{id}/receivers': {
      get: {
        tags: ['receivers'],
        summary: 'Получатели рассылки',
        parameters: [mailingId(), csvList.limit, csvList.format],
        responses: {
          200: okOrCsv(receiversList(ref('Receiver'))),
          400: badRequest
        }
      }
    },
    '/mailings/{id}/failed-receivers': {
      get: {
        tags: ['receivers'],
        summary: 'Получатели с ошибками доставки',
        description:
          'Адреса из списка получателей с ошибкой доставки после создания рассылки, ' +
          'а также адреса, которые mail-sorter уже исключил из рассылки ' +
          '(`excluded: true`, в CSV — четвёртая колонка `excluded`).',
        parameters: [mailingId(), csvList.limit, csvList.format],
        responses: {
          200: okOrCsv(receiversList(ref('FailedReceiver'))),
          400: badRequest,
          404: notFound
        }
      }
    },
    '/mailings/{id}/send-test-email': {
      post: {
        tags: ['mailings'],
        summary: 'Отправить тестовое письмо',
        parameters: [mailingId()],
        requestBody: body(sendTestEmailBody, { email: 'me@example.com' }),
        responses: {
          200: ok(),
          400: badRequest,
          404: notFound
        }
      }
    },
    '/mailings/{mailingId}/requestSubscription': {
      post: {
        tags: ['subscription'],
        summary: 'Запросить подписку',
        description:
          'Отправляет письмо со ссылкой подтверждения. Рассылка должна быть открыта ' +
          'для подписки (`openForSubscription`). `schedule` (или устаревшее ' +
          '`periodicDate`) — расписание периодической отправки.',
        parameters: [mailingId('mailingId')],
        requestBody: body(requestSubscriptionBody, { email: 'user@example.com', name: 'Имя' }),
        responses: {
          200: ok(),
          400: failure(
            'Ошибка: CLOSED_FOR_SUBSCRIPTION, INVALID_SCHEDULE или ошибка проверки тела'
          ),
          404: notFound
        }
      }
    },
    '/mailings/{mailingId}/subscribe': {
      post: {
        tags: ['subscription'],
        summary: 'Подтвердить подписку кодом из письма',
        parameters: [mailingId('mailingId')],
        requestBody: body(subscribeBody),
        responses: {
          200: ok(textAfter('textAfterSubscribe')),
          400: failure('Нет запроса на подписку или код не совпадает'),
          404: notFound
        }
      }
    },
    '/mailings/{mailingId}/unsubscribe': {
      post: {
        tags: ['subscription'],
        summary: 'Отписаться по коду',
        description: 'Если адрес ещё не подписан, удаляется его запрос на подписку.',
        parameters: [mailingId('mailingId')],
        requestBody: body(unsubscribeBody),
        responses: {
          200: ok(textAfter('textAfterUnsubscribe')),
          400: failure('Адрес не подписан или код не совпадает'),
          404: notFound
        }
      }
    },
    '/sorter/status': {
      get: {
        tags: ['mail-sorter'],
        summary: 'Итог последнего запуска mail-sorter',
        description:
          'Записывает mail-sorter в Redis (ключ MAIL_SORTER_STATUS) в конце каждого ' +
          'запуска. `null` — mail-sorter ещё ни разу не запускался с этим Redis.',
        responses: {
          200: ok({ oneOf: [ref('SorterStatus'), { type: 'null' }] })
        }
      }
    },
    '/mailings/{mailingId}/receivers/{receiverId}': {
      delete: {
        tags: ['receivers'],
        summary: 'Удалить получателя из рассылки',
        description: 'Из выполняющейся рассылки удалить нельзя.',
        parameters: [
          mailingId('mailingId'),
          {
            name: 'receiverId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Адрес получателя'
          }
        ],
        responses: {
          200: ok(),
          400: badRequest,
          404: failure('Рассылка или получатель не найдены')
        }
      }
    }
  },
  components: {
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { const: false },
          error: { type: 'string' },
          code: { type: 'string' }
        },
        required: ['success', 'error']
      },
      MailingState: {
        type: 'integer',
        enum: [1, 2, 3, 4, 5],
        description: 'NEW = 1, RUNNING = 2, PAUSED = 3, FINISHED = 4, ERROR = 5'
      },
      MailingSummary: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          listId: { type: 'string' },
          name: { type: 'string' },
          openForSubscription: { type: 'boolean' },
          autoResumeAt: {
            type: 'string',
            format: 'date-time',
            description: 'Когда рассылка продолжится после автоматической паузы ' +
              '(maxEmailsWithoutPause, pauseDuration)'
          },
          listUnsubscribe: {
            type: 'boolean',
            description: 'Добавлять заголовок List-Unsubscribe (server.mail.listUnsubscribe): ' +
              'по нему почтовые программы показывают кнопку «Отписаться». ' +
              'Для новых рассылок по умолчанию false'
          },
          from: { type: 'string', description: 'Пусто — адрес сервиса (server.mail.from)' },
          replyTo: { type: 'string' },
          sentCount: { type: 'integer', description: 'Сколько писем отправлено' },
          state: ref('MailingState'),
          undeliveredCount: { type: 'integer' }
        }
      },
      Mailing: {
        allOf: [
          ref('MailingSummary'),
          {
            type: 'object',
            properties: {
              creationDate: { type: 'integer', description: 'Unix time, секунды' },
              extraData: { type: 'object' },
              html: { type: 'string', description: 'Шаблон Handlebars' },
              subject: { type: 'string', description: 'Шаблон Handlebars' }
            }
          }
        ]
      },
      ReceiverInput: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          name: { type: 'string' },
          extraData: { type: 'object' }
        },
        required: ['email']
      },
      Receiver: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          name: { type: 'string' },
          periodicDate: { type: ['string', 'integer'] }
        }
      },
      SorterStatus: {
        type: 'object',
        properties: {
          startedAt: { type: 'string', format: 'date-time' },
          finishedAt: { type: 'string', format: 'date-time' },
          success: { type: 'boolean' },
          error: { type: 'string', description: 'Почему запуск не удался' },
          readonly: {
            type: 'boolean',
            description: 'Пробный запуск: ничего не менялось'
          },
          mailboxes: { type: 'array', items: { type: 'string' } },
          lastSuccessAt: { type: ['string', 'null'], format: 'date-time' },
          stale: {
            type: 'boolean',
            description: 'Успешного запуска не было дольше server.sorterStatusMaxAge ' +
              '(по умолчанию 2 часа)'
          },
          types: {
            type: 'object',
            additionalProperties: { type: 'integer' },
            description: 'Число писем по типам: HUMAN, MAIL_SERVER, AUTORESPONDER, UNSUBSCRIBE'
          },
          actions: {
            type: 'object',
            additionalProperties: { type: 'integer' },
            description: 'Число выполненных действий по названиям'
          },
          counters: {
            type: 'object',
            properties: {
              actionsPerformed: { type: 'integer' },
              failed: { type: 'integer' },
              successful: { type: 'integer' }
            }
          },
          failedMessages: {
            type: 'array',
            items: { type: 'integer' },
            description: 'Номера писем, обработка которых не удалась (не больше 50)'
          }
        }
      },
      FailedReceiver: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          status: { type: 'string', description: 'DSN status последней ошибки' },
          spam: { type: 'boolean' },
          diagnosticCode: { type: 'string' },
          excluded: {
            type: 'boolean',
            description: 'Адрес уже исключён из рассылки (mail-sorter)'
          }
        }
      }
    }
  }
};

function textAfter (field: string) {
  return {
    type: 'object',
    properties: {
      text: {
        type: ['string', 'null'],
        description: `Текст из extraData.${field} рассылки`
      }
    }
  };
}

export const swaggerUiHtml = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>mail-server API</title>
  <link rel="icon" type="image/png" href="favicon-32x32.png">
  <link rel="stylesheet" href="swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="swagger-ui-bundle.js"></script>
  <script src="init.js"></script>
</body>
</html>
`;

// Отдельным файлом, а не встроенным скриптом, — чтобы работало и при строгом CSP
export const swaggerUiInit = `window.ui = SwaggerUIBundle({
  url: '../openapi.json',
  dom_id: '#swagger-ui'
});
`;
