import { stringify } from 'csv-stringify/sync';


export async function serializeToCsv (data: string[][]): Promise<string> {
  return stringify(data);
}
