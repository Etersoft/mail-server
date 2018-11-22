import { readFileSync } from 'fs';
import { resolve } from 'path';
import { HandlebarsTemplate } from './HandlebarsTemplate';


export function readHandlebarsTemplate (filename: string) {
  const path = resolve(__dirname, '..', '..', '..', 'templates', filename);
  try {
    return new HandlebarsTemplate(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error('Failed to read required template: ' + path);
  }
}
