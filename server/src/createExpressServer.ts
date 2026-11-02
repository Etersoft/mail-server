import express, { Express } from 'express';
import cors from 'cors';
import { bodyParser } from './middleware/bodyParser';


export function createExpressServer (config: any): Express {
  const app = express();
  // За nginx на той же машине req.ip берётся из X-Forwarded-For
  app.set('trust proxy', 'loopback');
  const parserMiddleware = bodyParser();
  const whitelist = config.corsWhitelist;
  const corsOptions = {
    credentials: true,
    origin: whitelist
  };
  app.use(cors(corsOptions));
  app.post('/{*path}', parserMiddleware);
  app.put('/{*path}', parserMiddleware);
  return app;
}
