import { Mailing } from './Mailing';
import * as moment from 'moment';


export function getListId (config: any, mailing: Mailing): string {
  const date = new Date();
  const dateFormatted = moment().format('YYYYMMDD');
  return `<${dateFormatted}-${mailing.id}@${config.server.mail.listIdDomain}>`;
}
