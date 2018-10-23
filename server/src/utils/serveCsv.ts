import { serializeToCsv } from './serializeToCsv';
import { Response } from 'express';


export async function serveCsv (res: Response, data: Array<Array<string>>, filename: string) {
  const output = await serializeToCsv(data);
  res.header('content-type', 'text/csv');
  res.header('content-disposition', `attachment; filename=${filename}`);
  res.send(output);
}
