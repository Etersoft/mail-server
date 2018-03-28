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
      validate.errors.map(err => {
        const fullPath = 'root' + err.dataPath;
        return fullPath + ': ' + err.message;
      }).join('\n')
    ));
  };
}
