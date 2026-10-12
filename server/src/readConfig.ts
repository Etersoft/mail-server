import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';


const ROOT = join(__dirname, '..', '..', '..');

export function readConfig (): any {
  const baseConfig = readJson(join(ROOT, 'config.default.json'));
  const userConfigPath = join(ROOT, 'config.json');

  if (existsSync(userConfigPath)) {
    return deepMerge(baseConfig, readJson(userConfigPath));
  }

  return baseConfig;
}

function readJson (path: string) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function isObject (value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// Значения из source накладываются на target, вложенные объекты сливаются
export function deepMerge (
  target: Record<string, unknown>, source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }
    const current = result[key];
    result[key] = isObject(value) && isObject(current) ? deepMerge(current, value) : value;
  }
  return result;
}
