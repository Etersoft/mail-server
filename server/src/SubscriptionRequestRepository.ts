import { SubscriptionRequestProperties, SubscriptionRequest } from './SubscriptionRequest';

/**
 * Интерфейс хранилища, содержащего информацию о заявках на подписку
 */
export interface SubscriptionRequestRepository {
  create (properties: SubscriptionRequestProperties): Promise<SubscriptionRequest>;
  get (key: { mailingId: number, email: string }): Promise<SubscriptionRequest | null>;
  remove (request: SubscriptionRequest): Promise<void>;
}
