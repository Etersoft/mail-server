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
  getReceivers (id: number, start?: number, stop?: number): Promise<Receiver[]>;
  getReceiverCount (id: number): Promise<number>;
  setReceivers (id: number, receivers: Receiver[]): Promise<void>;
  remove (mailing: Mailing): Promise<void>;
  update (mailing: Mailing): Promise<void>;
  updateInTransaction (
    mailingId: number, scenario: (mailing: Mailing) => Promise<void> | void
  ): Promise<Mailing | null>;
}
