import { createClient, createClientPool } from 'redis';


export type RedisClient = ReturnType<typeof createClient>;

export interface RedisConfig {
  db?: number;
  host?: string;
  password?: string;
  path?: string;
  port?: number;
  url?: string;
}

export interface RedisPoolConfig {
  max?: number;
  min?: number;
}

export interface RedisConnectionPool {
  close (): Promise<void>;
  /**
   * Выполняет сценарий на отдельном соединении из пула: пока сценарий
   * не завершится, соединение никто больше не использует (это нужно для WATCH)
   */
  runWithConnection<T> (scenario: (client: RedisClient) => Promise<T>): Promise<T>;
}

/**
 * Переводит параметры клиента redis 2.x (формат конфига mail-server)
 * в параметры node-redis 4+
 */
export function toClientOptions (config: RedisConfig) {
  if (config.url) {
    return { database: config.db, password: config.password, url: config.url };
  }
  return {
    database: config.db,
    password: config.password,
    socket: { host: config.host, path: config.path, port: config.port }
  };
}

export class RedisConnectionPoolImpl implements RedisConnectionPool {
  private pool: ReturnType<typeof createClientPool>;
  private connected?: Promise<unknown>;

  constructor (redisConfig: RedisConfig, poolOptions: RedisPoolConfig = {}) {
    this.pool = createClientPool(toClientOptions(redisConfig), {
      maximum: poolOptions.max,
      minimum: poolOptions.min
    });
  }

  async close () {
    if (this.connected) {
      await this.connected;
      await this.pool.close();
    }
  }

  async runWithConnection<T> (scenario: (client: RedisClient) => Promise<T>): Promise<T> {
    if (!this.connected) {
      this.connected = this.pool.connect();
    }
    await this.connected;
    return this.pool.execute(client => scenario(client as unknown as RedisClient));
  }
}
