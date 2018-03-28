import * as express from 'express';
import { Express } from 'express';
import { getMailings } from './controllers/getMailings';
import { bodyParser } from './middleware/bodyParser';


export function createExpressServer (config: any): Express {
  const app = express();
  const parserMiddleware = bodyParser();
  app.post('*', parserMiddleware);
  app.put('*', parserMiddleware);
  return app;
}
