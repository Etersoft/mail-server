import { Request, Response, NextFunction } from 'express';
import { ApiKeyRecord, ApiKeyRepository } from '../ApiKeyRepository';
import { Logger } from '../Logger';
import { error } from '../utils/response';


export interface ApiAuthConfig {
  /**
   * false — запросы без ключа пропускаются и записываются в журнал (на время
   * перехода, чтобы найти всех, кому нужен ключ); true — без ключа ответ 401.
   * Неизвестный ключ отклоняется всегда
   */
  required?: boolean;
}

/**
 * Кто сделал запрос: имя ключа и, для ключа фронта, пользователь из X-Remote-User
 */
export interface Actor {
  key?: string;
  user?: string;
}

// Время последнего использования ключа пишется в Redis не чаще раза в минуту
const TOUCH_INTERVAL = 60 * 1000;
// Запрос без ключа с того же адреса к тому же методу записывается раз в 10 минут
const ANONYMOUS_LOG_INTERVAL = 10 * 60 * 1000;
const MAX_REMEMBERED_ANONYMOUS = 1000;

export function getActor (res: Response): Actor {
  return res.locals.actor || {};
}

export function describeActor (actor: Actor): string {
  if (!actor.key) {
    return 'anonymous';
  }
  return actor.user ? `${actor.user} via ${actor.key}` : actor.key;
}

/**
 * Проверка ключа API: Authorization: Bearer <ключ> или X-API-Key: <ключ>.
 * Изменяющие запросы записываются в журнал с именем ключа и пользователя
 */
export function apiKeyAuth (
  repository: ApiKeyRepository, logger: Logger, config: ApiAuthConfig,
  isPublic: (req: Request) => boolean
) {
  const touchedAt = new Map<string, number>();
  const anonymousLoggedAt = new Map<string, number>();

  function touch (record: ApiKeyRecord) {
    const now = Date.now();
    if (now - (touchedAt.get(record.name) || 0) < TOUCH_INTERVAL) {
      return;
    }
    touchedAt.set(record.name, now);
    repository.touch(record.name).catch(err => logger.error(err));
  }

  function logAnonymous (req: Request) {
    // Номера рассылок и адреса в пути не важны: иначе каждый запрос был бы новым
    const route = `${req.ip} ${req.method} ${req.path.replace(/\/[^/]*[\d@][^/]*/g, '/:id')}`;
    const now = Date.now();
    if (now - (anonymousLoggedAt.get(route) || 0) < ANONYMOUS_LOG_INTERVAL) {
      return;
    }
    if (anonymousLoggedAt.size >= MAX_REMEMBERED_ANONYMOUS) {
      anonymousLoggedAt.clear();
    }
    anonymousLoggedAt.set(route, now);
    logger.warn(`Request without API key: ${route}`);
  }

  return async function (req: Request, res: Response, next: NextFunction) {
    if (req.method === 'OPTIONS' || isPublic(req)) {
      next();
      return;
    }

    const key = getRequestKey(req);
    if (key) {
      const record = await repository.findByKey(key);
      if (!record) {
        logger.warn(`Invalid API key from ${req.ip}: ${req.method} ${req.path}`);
        res.status(401).set('WWW-Authenticate', 'Bearer').json(
          error('Invalid API key', 'INVALID_API_KEY')
        );
        return;
      }
      touch(record);
      const user = record.proxy ? headerValue(req, 'x-remote-user') : undefined;
      res.locals.actor = { key: record.name, user } as Actor;
    } else if (config.required) {
      res.status(401).set('WWW-Authenticate', 'Bearer').json(
        error('API key required', 'API_KEY_REQUIRED')
      );
      return;
    } else {
      logAnonymous(req);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      logger.info(
        `${req.method} ${req.path} by ${describeActor(getActor(res))} from ${req.ip}` +
        summarizeBody(req.body)
      );
    }
    next();
  };
}

function getRequestKey (req: Request): string | undefined {
  const authorization = headerValue(req, 'authorization');
  const match = authorization && /^Bearer\s+(\S+)\s*$/i.exec(authorization);
  if (match) {
    return match[1];
  }
  return headerValue(req, 'x-api-key');
}

function headerValue (req: Request, name: string): string | undefined {
  const value = req.headers[name];
  const text = Array.isArray(value) ? value[0] : value;
  return text ? text.trim() || undefined : undefined;
}

// Для журнала: какие поля пришли, без текста письма и адресов
function summarizeBody (body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return '';
  }
  const fields = Object.entries(body).map(([name, value]) => {
    if (name === 'state' || name === 'sourceId') {
      return `${name}=${String(value)}`;
    }
    if (Array.isArray(value)) {
      return `${name}[${value.length}]`;
    }
    return name;
  });
  return fields.length ? `: ${fields.join(', ')}` : '';
}
