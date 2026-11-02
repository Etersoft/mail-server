import { createHash, randomBytes } from 'node:crypto';
import { RedisConnectionPool } from './RedisConnectionPool';


export interface ApiKeyRepositoryConfig {
  // имя ключа -> JSON с описанием (ApiKeyRecord без имени и lastUsedAt)
  apiKeysKey: string;
  // sha256 ключа -> имя ключа
  apiKeyHashesKey: string;
  // имя ключа -> время последнего использования (ISO)
  apiKeysLastUsedKey: string;
}

const defaultConfig: ApiKeyRepositoryConfig = {
  apiKeyHashesKey: 'API_KEY_HASHES',
  apiKeysKey: 'API_KEYS',
  apiKeysLastUsedKey: 'API_KEYS_LAST_USED'
};

export interface ApiKeyRecord {
  createdAt: string;
  hash: string;
  lastUsedAt?: string;
  name: string;
  /**
   * Ключ обратного прокси (фронта): только с ним сервер верит заголовку
   * X-Remote-User — имени пользователя, вошедшего на фронте
   */
  proxy: boolean;
}

// Имя попадает в журнал и в командную строку, поэтому без пробелов и спецсимволов
export const API_KEY_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function hashApiKey (key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Ключи доступа к API. Сам ключ не хранится — только sha256: показать его
 * можно один раз, при создании
 */
export class ApiKeyRepository {
  private readonly config: ApiKeyRepositoryConfig;

  constructor (
    private readonly redisConnectionPool: RedisConnectionPool,
    config: Partial<ApiKeyRepositoryConfig> = {}
  ) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Создаёт ключ и возвращает его; null, если ключ с таким именем уже есть
   */
  async add (name: string, proxy = false): Promise<string | null> {
    if (!API_KEY_NAME_PATTERN.test(name)) {
      throw new Error(`Invalid key name "${name}": use letters, digits, ".", "_", "-"`);
    }
    const key = 'ep_' + randomBytes(32).toString('base64url');
    const hash = hashApiKey(key);
    const record = { createdAt: new Date().toISOString(), hash, proxy };
    return this.redisConnectionPool.runWithConnection(async client => {
      const created = await client.hSetNX(this.config.apiKeysKey, name, JSON.stringify(record));
      if (!created) {
        return null;
      }
      await client.hSet(this.config.apiKeyHashesKey, hash, name);
      return key;
    });
  }

  async findByKey (key: string): Promise<ApiKeyRecord | null> {
    const hash = hashApiKey(key);
    return this.redisConnectionPool.runWithConnection(async client => {
      const name = await client.hGet(this.config.apiKeyHashesKey, hash);
      if (!name) {
        return null;
      }
      const json = await client.hGet(this.config.apiKeysKey, name);
      if (!json) {
        return null;
      }
      const record = { ...JSON.parse(json), name };
      // Индекс мог остаться от отозванного и заново созданного ключа с тем же именем
      return record.hash === hash ? record : null;
    });
  }

  async list (): Promise<ApiKeyRecord[]> {
    return this.redisConnectionPool.runWithConnection(async client => {
      const records = await client.hGetAll(this.config.apiKeysKey);
      const lastUsed = await client.hGetAll(this.config.apiKeysLastUsedKey);
      return Object.entries(records)
        .map(([name, json]) => ({ ...JSON.parse(json), lastUsedAt: lastUsed[name], name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  /**
   * Отзывает ключ; false, если ключа с таким именем нет
   */
  async revoke (name: string): Promise<boolean> {
    return this.redisConnectionPool.runWithConnection(async client => {
      const json = await client.hGet(this.config.apiKeysKey, name);
      if (!json) {
        return false;
      }
      const { hash } = JSON.parse(json);
      await client.multi()
        .hDel(this.config.apiKeysKey, name)
        .hDel(this.config.apiKeyHashesKey, hash)
        .hDel(this.config.apiKeysLastUsedKey, name)
        .exec();
      return true;
    });
  }

  async touch (name: string, date = new Date()): Promise<void> {
    await this.redisConnectionPool.runWithConnection(async client => {
      await client.hSet(this.config.apiKeysLastUsedKey, name, date.toISOString());
    });
  }
}
