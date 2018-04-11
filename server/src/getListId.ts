import { Mailing } from './Mailing';


export function getListId (config: any, mailing: Mailing): string {
  const date = new Date();
  const dateFormatted = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  return config.server.mail.listIdPrefix + mailing.id + '_' + dateFormatted;
}
