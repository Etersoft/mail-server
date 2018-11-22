import * as moment from 'moment';


export interface ReceiverProperties {
  email: string;
  name?: string;
  code?: string;
  periodicDate?: number;
}


/**
 * Класс получателя рассылки
 */
export class Receiver {
  constructor (
    public email: string,
    public name?: string,
    public code?: string,
    public periodicDate?: number
  ) {}

  getStringRepresentation () {
    if (typeof this.name === 'string') {
      return `${this.name} <${this.email}>`;
    } else {
      return this.email;
    }
  }

  shouldSendAt (date: moment.Moment) {
    const isLastDayOfMonth = date.clone().endOf('month').startOf('day').date() === date.date();
    return (
      !this.periodicDate || // нет даты - шлём каждый раз
      this.periodicDate === date.date() || // число совпадает
      isLastDayOfMonth && this.periodicDate > date.date() // такого числа нет в этом месяце
    );
  }

  toString () {
    return this.getStringRepresentation();
  }
}
