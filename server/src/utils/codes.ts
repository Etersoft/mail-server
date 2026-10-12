import { randomUUID } from 'node:crypto';


export function generateUniqueCode (): string {
  return randomUUID();
}
