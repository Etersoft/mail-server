export interface SubscriptionRequestProperties {
  // кто хочет подписаться
  email: string;
  // на какую рассылку
  mailingId: number;
  // код подтверждения подписки
  code: string;
  // для периодических рассылок - когда рассылать (число)
  periodicDate?: string;
  // имя подписчика
  name?: string;
  // роизвольные данные
  extraData?: { [field: string]: any };
}

/**
 * Запрос на подписку на рассылку (неподтверждённая заявка)
 */
export class SubscriptionRequest implements SubscriptionRequestProperties {
  email: string;
  mailingId: number;
  code: string;
  periodicDate?: string;
  name?: string;
  extraData?: { [field: string]: any };

  constructor (properties: SubscriptionRequestProperties) {
    this.email = properties.email;
    this.mailingId = properties.mailingId;
    this.code = properties.code;
    this.periodicDate = properties.periodicDate;
    this.name = properties.name;
    this.extraData = properties.extraData;
  }
}
