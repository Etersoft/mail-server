import { AddressStats } from './AddressStats';
import { RedisConnectionPool } from './RedisConnectionPool';
import { PromiseRedisClient } from 'src/createRedisClient';
import { Multi } from 'redis';


export abstract class BaseRedisRepository<Entity, Key> {
  constructor (
    protected redisConnectionPool: RedisConnectionPool
  ) {}

  // Этот метод - адаптация более общего сценария транзакции для обновления
  // одного объекта по ключу
  async updateInTransaction (
    key: Key, scenario: (entity: Entity) => Promise<void> | void
  ): Promise<Entity | null> {
    const redisKey = this.getCommonDataKey(key);
    let entity: Entity | null;
    return this.genericTransaction(
      [ redisKey ],

      async redisClient => {
        entity = await this.getByKey(key, redisClient);
        if (!entity) {
          return false;
        }
        await scenario(entity);
        return true;
      },

      async multi => {
        const jsonString = this.serializeEntity(entity!);
        multi.set(redisKey, jsonString);
        return entity;
      }
    );
  }

  protected abstract getByKey (
    key: Key, client: PromiseRedisClient
  ): Promise<Entity | null>;
  protected abstract getCommonDataKey (key: Key): string;
  protected abstract serializeEntity (entity: Entity): string;
  /**
   * Работает в четыре основных шага.
   * 1. Сначала вызывается watch для указанных ключей.
   * 2. Выполняется beforeTransaction, если вернётся false, то остановка и возврат null.
   * 3. Выполняется transaction с multi-клиентом.
   * 4. Выполняется exec. В случае успеха, возвращается result из transaction,
   * иначе - переход к шагу 1.
   * 
   * @param keysToWatch Ключи, изменение которых в промежутке между шагами 1 и 3 приведёт
   * к провалу exec
   * @param beforeTransaction Выполнение действий перед транзакцией - например, поиск
   * данных, на основе которых будет произведена транзакция
   * @param transaction Сценарий транзакции с multi-клиентом (exec не нужно вызывать
   * изнутри, он будет вызван автоматически)
   */
  protected genericTransaction<Result> (
    keysToWatch: string[],
    beforeTransaction: (client: PromiseRedisClient) => Promise<boolean>,
    transaction: (multi: Multi) => Promise<Result> | Result
  ): Promise<Result | null> {
    async function scenario (redisClient: PromiseRedisClient) {
      // Реализуем optimistic locking, чтобы бороться с параллельными обновлениями
      // одного и того же объекта
      while (true) {
        // Отслеживаем изменения ключа. Если он изменится с момента вызова
        // watch, всё выполнится заново.
        await redisClient.watchAsync(keysToWatch);
        const shouldContinue = await beforeTransaction(redisClient);
        if (!shouldContinue) {
          // Очистим соединение, если решили не продолжать
          await redisClient.unwatchAsync();
          return null;
        }
        // Пробуем обновить...
        const multi = redisClient.multi();
        const result = await transaction(multi);
        // Если exec завершился успешно, то выходим.
        // Если нет, то начинаем заново...
        if (await multi.execAsync()) {
          return result;
        }
      }
    };
    return this.redisConnectionPool.runWithConnection<Result | null>(scenario);
  }
}
