import { Mailing, MailingProperties } from './Mailing';
import { Receiver, ReceiverProperties } from './Receiver';


/**
 * Интерфейс хранилища, содержащего информацию о рассылках (как выполненных,
 * так и выполняющихся)
 */
export interface MailingRepository {
  create (properties: MailingProperties, receivers: ReceiverProperties[]): Promise<Mailing>;
  /**
   * Получение рассылок из хранилища
   */
  getAll (): Promise<Mailing[]>;
  getById (id: number): Promise<Mailing | null>;
  getByListId (listId: string): Promise<Mailing | null>;
  /**
   * Получение списка получателей
   */
  getReceivers (id: number): Promise<Receiver[]>;
  remove (mailing: Mailing): Promise<void>;
  update (mailing: Mailing): Promise<void>;
}
