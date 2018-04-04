import { Mailing } from './Mailing';


export function getListId (config: any, mailing: Mailing): string {
  return config.server.mail.listIdPrefix + mailing.id + '-' + new Date().toISOString();
}
