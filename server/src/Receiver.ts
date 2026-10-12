import { stringToArray } from 'cron-converter';


export interface ReceiverProperties {
  email: string;
  name?: string;
  code?: string;
  periodicDate?: string;
  extraData?: { [field: string]: any };
}


/**
 * Класс получателя рассылки
 */
export class Receiver {
  static validateSchedule (schedule: string) {
    const date = Number(schedule);
    if (date > 0 && date <= 31) {
      return true;
    }
    try {
      stringToArray('* * ' + schedule);
      return true;
    } catch (error) {
      return false;
    }
  }

  constructor (
    public email: string,
    public name?: string,
    public code?: string,
    public periodicDate?: string,
    public extraData?: { [field: string]: any }
  ) {}

  getStringRepresentation () {
    if (typeof this.name === 'string') {
      return `${this.name} <${this.email}>`;
    } else {
      return this.email;
    }
  }

  shouldSendAt (date: Date) {
    if (!this.periodicDate) {
      // нет даты - шлём каждый раз
      return true;
    }

    return this.hasPlainDate() ? this.matchPlainDate(date) : this.matchCronSchedule(date);
  }

  toString () {
    return this.getStringRepresentation();
  }

  private hasPlainDate () {
    return !isNaN(Number(this.periodicDate));
  }

  private isLastDayOfMonth (date: Date) {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return lastDay === date.getDate();
  }

  private matchCronSchedule (date: Date) {
    const [ , , dates, months, days ] = stringToArray('* * ' + this.periodicDate);

    const dateOk = dates.includes(date.getDate());
    const monthOk = months.includes(date.getMonth() + 1);
    const dayOk = days.includes(date.getDay());
    return (
      (
        dateOk && monthOk && dayOk // дата, месяц и день недели просто есть в расписании cron
      ) ||
      ( // это последний день месяца, а в расписании есть числа больше
        monthOk && dayOk &&
        this.isLastDayOfMonth(date) && dates.some(d => d > date.getDate())
      )
    );
  }

  private matchPlainDate (date: Date) {
    const periodicDate = Number(this.periodicDate);
    return (
      periodicDate === date.getDate() || // число совпадает
      this.isLastDayOfMonth(date) && periodicDate > date.getDate() // такого числа нет в этом месяце
    );
  }
}
