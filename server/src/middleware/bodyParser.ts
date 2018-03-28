import * as bodyParserLib from 'body-parser';
import { Request, Response, NextFunction } from 'express';
import { error } from '../utils/response';


export function bodyParser () {
  return [
    bodyParserLib.text({ type: '*/*' }),
    jsonParser()
  ];
}

function jsonParser () {
  return function (req: Request, res: Response, next: NextFunction) {
    try {
      req.body = JSON.parse(req.body);
      next();
    } catch (err) {
      res.status(400).json(error('JSON parse error'));
    }
  };
}
