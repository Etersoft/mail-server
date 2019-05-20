import * as moment from 'moment';
import Cron = require('cron-converter');


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
      const cron = new Cron();
      cron.fromString('* * ' + schedule);
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

  shouldSendAt (date: moment.Moment) {
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

  private isLastDayOfMonth (date: moment.Moment) {
    return date.clone().endOf('month').startOf('day').date() === date.date();
  }

  private matchCronSchedule (date: moment.Moment) {
    const schedule = new Cron();
    schedule.fromString('* * ' + this.periodicDate);
    const [ , , dates, months, days ] = schedule.toArray();

    const dateOk = dates.indexOf(date.date()) !== -1;
    const monthOk = months.indexOf(date.month() + 1) !== -1;
    const dayOk = days.indexOf(date.day()) !== -1;
    return (
      (
        dateOk && monthOk && dayOk // дата, месяц и день недели просто есть в расписании cron
      ) ||
      ( // это последний день месяца, а в расписании есть числа больше
        monthOk && dayOk &&
        this.isLastDayOfMonth(date) && dates.some(d => d > date.date())
      )
    );
  }

  private matchPlainDate (date: moment.Moment) {
    const periodicDate = Number(this.periodicDate);
    return (
      periodicDate === date.date() || // число совпадает
      this.isLastDayOfMonth(date) && periodicDate > date.date() // такого числа нет в этом месяце
    );
  }
}
