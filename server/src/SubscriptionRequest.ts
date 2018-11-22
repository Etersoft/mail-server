export interface SubscriptionRequestProperties {
  // кто хочет подписаться
  email: string;
  // на какую рассылку
  mailingId: number;
  // код подтверждения подписки
  code: string;
  // для периодических рассылок - когда рассылать (число)
  periodicDate?: number;
}

/**
 * Запрос на подписку на рассылку (неподтверждённая заявка)
 */
export class SubscriptionRequest implements SubscriptionRequestProperties {
  email: string;
  mailingId: number;
  code: string;
  periodicDate?: number;

  constructor (properties: SubscriptionRequestProperties) {
    this.email = properties.email;
    this.mailingId = properties.mailingId;
    this.code = properties.code;
    this.periodicDate = properties.periodicDate;
  }
}
