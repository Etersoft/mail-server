import * as Ajv from 'ajv';
import { Request, Response, NextFunction } from 'express';
import { error } from '../utils/response';


export function jsonSchemaMiddleware (schema: any) {
  const ajv = new Ajv();
  const validate = ajv.compile(schema);
  return function (req: Request, res: Response, next: NextFunction) {
    const result = validate(req.body);
    if (result || !validate.errors) {
      next();
      return;
    }
    res.status(400).json(error(
      validate.errors.map(error => {
        const fullPath = 'root' + error.dataPath;
        return fullPath + ': ' + error.message;
      }).join('\n')
    ));
  };
}