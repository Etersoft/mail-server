import { Mailing } from './Mailing';


export function getListId (config: any, mailing: Mailing): string {
  const now = new Date();
  const dateFormatted = String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  return `<${dateFormatted}-${mailing.id}@${config.server.mail.listIdDomain}>`;
}
