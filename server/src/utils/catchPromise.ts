import { RequestHandler, Request, Response } from 'express';
import { error } from './response';


type PromiseHandler = (req: Request, res: Response) => Promise<unknown>;

/**
 * Оборачивает express-обработчик, и, в случае возврата им Promise,
 * ловит ошибку и отвечает 500-ым кодом.
 */
export function catchPromise (handler: PromiseHandler): RequestHandler {
  return async function (req: Request, res: Response) {
    try {
      await handler(req, res);
    } catch (err) {
      console.error('Request error: ', err);
      res.status(500).json(error('Internal Server Error', 'INTERNAL_SERVER_ERROR'));
    }
  };
}
