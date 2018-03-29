import * as express from 'express';
import { Express } from 'express';
import * as cors from 'cors';
import { getMailings } from './controllers/getMailings';
import { bodyParser } from './middleware/bodyParser';


export function createExpressServer (config: any): Express {
  const app = express();
  const parserMiddleware = bodyParser();
  const whitelist = config.corsWhitelist;
  const corsOptions = {
    credentials: true,
    origin: whitelist
  };
  app.use(cors(corsOptions));
  app.post('*', parserMiddleware);
  app.put('*', parserMiddleware);
  return app;
}
