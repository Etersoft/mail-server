import { Mailing } from './Mailing';


// List-Id по RFC 2919: <метка.домен>, без «@». Метка — дата и номер
// рассылки в пространстве имён eterpost внутри listIdDomain
export function getListId (config: any, mailing: Mailing): string {
  const now = new Date();
  const dateFormatted = String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  return `<${dateFormatted}-${mailing.id}.eterpost.${config.server.mail.listIdDomain}>`;
}
