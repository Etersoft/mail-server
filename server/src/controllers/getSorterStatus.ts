import { Request, Response } from 'express';
import { success } from '../utils/response';
import { catchPromise } from '../utils/catchPromise';
import { RedisSorterStatusRepository } from '../RedisSorterStatusRepository';


// mail-sorter по умолчанию запускается раз в час
const DEFAULT_MAX_AGE = 2 * 60 * 60;

export function getSorterStatus (
  repository: RedisSorterStatusRepository, config: any
) {
  const maxAge: number = config.server.sorterStatusMaxAge || DEFAULT_MAX_AGE;
  return catchPromise(async function (req: Request, res: Response) {
    const status = await repository.get();
    if (!status) {
      res.json(success(null));
      return;
    }
    // Давно не было успешного запуска: таймер не работает или каждый запуск
    // завершается ошибкой
    const lastSuccess = status.lastSuccessAt ? Date.parse(status.lastSuccessAt) : 0;
    res.json(success({
      ...status,
      stale: Date.now() - lastSuccess > maxAge * 1000
    }));
  });
}
