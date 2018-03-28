import { RequestHandler, Request, Response } from 'express';
import { error } from './response';


type PromiseHandler = (req: Request, res: Response) => any;

export function catchPromise (handler: PromiseHandler): RequestHandler {
  return async function (req: Request, res: Response) {
    try {
      const result = await handler(req, res);
    } catch (err) {
      // tslint:disable-next-line:no-console
      console.error('Request error: ', err);
      res.status(500).json(error('Internal Server Error'));
    }
  };
}
