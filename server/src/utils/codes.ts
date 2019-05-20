import * as uuid from 'uuid/v4';


export function generateUniqueCode (): string {
  return uuid();
}
