import { RedisConnectionPool } from './RedisConnectionPool';


export interface RedisSorterStatusRepositoryConfig {
  sorterStatusKey: string;
}

const defaultConfig: RedisSorterStatusRepositoryConfig = {
  sorterStatusKey: 'MAIL_SORTER_STATUS'
};

/**
 * Итог последнего запуска mail-sorter. Записывает его mail-sorter
 * (RedisSorterStatusRepository в src/services/RedisRepositories.js),
 * mail-server только читает: при изменении формата поправить и там
 */
export interface SorterStatus {
  startedAt: string;
  finishedAt: string;
  success: boolean;
  error?: string;
  readonly: boolean;
  mailboxes: string[];
  lastSuccessAt: string | null;
  // Число писем по типам: HUMAN, MAIL_SERVER, AUTORESPONDER, UNSUBSCRIBE
  types?: Record<string, number>;
  // Число выполненных действий по названиям ('unsubscribe', 'mark as read', ...)
  actions?: Record<string, number>;
  counters?: { actionsPerformed: number; failed: number; successful: number };
  failedMessages?: number[];
}

export class RedisSorterStatusRepository {
  constructor (
    private readonly redisConnectionPool: RedisConnectionPool,
    config: Partial<RedisSorterStatusRepositoryConfig> = {}
  ) {
    this.config = { ...defaultConfig, ...config };
  }

  private readonly config: RedisSorterStatusRepositoryConfig;

  get (): Promise<SorterStatus | null> {
    return this.redisConnectionPool.runWithConnection(async redisClient => {
      const json = await redisClient.get(this.config.sorterStatusKey);
      return json ? JSON.parse(json) : null;
    });
  }
}
