import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { Request, Response, NextFunction } from 'express';
import { error } from '../utils/response';


const ajv = new Ajv({ allErrors: false, strict: false });
addFormats(ajv);

export function jsonSchemaMiddleware (schema: object) {
  const validate = ajv.compile(schema);
  return function (req: Request, res: Response, next: NextFunction) {
    const result = validate(req.body);
    if (result || !validate.errors) {
      next();
      return;
    }
    res.status(400).json(error(
      validate.errors.map(err => {
        const fullPath = 'root' + toDataPath(err.instancePath);
        return fullPath + ': ' + err.message;
      }).join('\n')
    ));
  };
}

// ajv 8 даёт путь в формате JSON Pointer (/a/0/b); в ответах API сохраняем
// формат ajv 6 (.a[0].b)
function toDataPath (instancePath: string): string {
  return instancePath.split('/').slice(1).map(part => {
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    return /^\d+$/.test(key) ? `[${key}]` : `.${key}`;
  }).join('');
}
