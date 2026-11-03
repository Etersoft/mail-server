import { Mailing, MailingProperties } from './Mailing';
import { Receiver, ReceiverProperties } from './Receiver';


/**
 * Получатель, которому сервер временно отказал на RCPT TO (4xx): письмо ему
 * отправляется ещё раз после основного прохода рассылки
 */
export interface RcptRetry {
  // Сколько повторов уже сделано
  attempts: number;
  email: string;
  // Когда повторить (мс с начала эпохи)
  nextAt: number;
  // Последний ответ сервера
  response: string;
}


/**
 * Интерфейс хранилища, содержащего информацию о рассылках (как выполненных,
 * так и выполняющихся)
 */
export interface MailingRepository {
  addReceiver (mailingId: number, receiver: Receiver): Promise<void>;
  advancePosition (mailingId: number, receiver: Receiver, sent: boolean): Promise<Mailing | null>;
  create (properties: MailingProperties, receivers: ReceiverProperties[]): Promise<Mailing>;
  /**
   * Получение рассылок из хранилища
   */
  getAll (): Promise<Mailing[]>;
  getById (id: number): Promise<Mailing | null>;
  getByListId (listId: string): Promise<Mailing | null>;
  /**
   * Адреса, исключённые из рассылки из-за ошибок доставки
   */
  getExcludedEmails (id: number): Promise<string[]>;
  /**
   * Получение списка получателей
   */
  getReceivers (id: number, start?: number, stop?: number): Promise<Receiver[]>;
  getReceiverCount (id: number): Promise<number>;
  getNextReceiver (id: number): Promise<Receiver | null>;
  /**
   * Повторы отправки после временного отказа на RCPT TO, по времени повтора
   */
  getRetries (id: number): Promise<RcptRetry[]>;
  setRetry (id: number, retry: RcptRetry): Promise<void>;
  removeRetry (id: number, email: string): Promise<void>;
  clearRetries (id: number): Promise<void>;
  setReceivers (id: number, receivers: Receiver[]): Promise<void>;
  remove (mailing: Mailing): Promise<void>;
  removeReceiver (id: number, receiver: Receiver, excluded?: boolean): Promise<boolean>;
  update (mailing: Mailing): Promise<void>;
  updateInTransaction (
    mailingId: number, scenario: (mailing: Mailing) => Promise<void> | void
  ): Promise<Mailing | null>;
}
