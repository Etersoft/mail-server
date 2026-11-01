import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';


const ROOT = join(__dirname, '..', '..', '..');

export function readConfig (): any {
  const baseConfig = readJson(join(ROOT, 'config.default.json'));
  const userConfigPath = join(ROOT, 'config.json');

  if (existsSync(userConfigPath)) {
    return substituteEnv(deepMerge(baseConfig, readJson(userConfigPath)), process.env);
  }

  return substituteEnv(baseConfig, process.env);
}

// %{NAME} в строках заменяется переменной окружения NAME: так пароли
// хранятся не в config.json, а в файле окружения службы
export function substituteEnv (value: unknown, env: Record<string, string | undefined>): any {
  if (typeof value === 'string') {
    return value.replace(/%\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name: string) => {
      const resolved = env[name];
      if (resolved === undefined) {
        throw new Error(`Environment variable ${name} is not set (used in config as ${match})`);
      }
      return resolved;
    });
  }
  if (Array.isArray(value)) {
    return value.map(item => substituteEnv(item, env));
  }
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, substituteEnv(item, env)])
    );
  }
  return value;
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
