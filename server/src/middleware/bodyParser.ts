import express, { Request, Response, NextFunction } from 'express';
import { error } from '../utils/response';


/**
 * Тело запроса разбирается как JSON независимо от Content-Type
 */
export function bodyParser () {
  return [
    express.text({
      limit: '50mb',
      type: '*/*'
    }),
    jsonParser()
  ];
}

function jsonParser () {
  return function (req: Request, res: Response, next: NextFunction) {
    try {
      req.body = JSON.parse(req.body);
      next();
    } catch {
      res.status(400).json(error('JSON parse error'));
    }
  };
}
