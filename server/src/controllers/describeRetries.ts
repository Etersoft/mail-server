import { MailingRepository } from '../MailingRepository';


/**
 * Ожидающие повторы после временного отказа на RCPT TO: сколько адресов и
 * когда ближайший повтор
 */
export async function describeRetries (mailingRepository: MailingRepository, id: number) {
  const retries = await mailingRepository.getRetries(id);
  return {
    nextRetryAt: retries.length ? new Date(retries[0].nextAt).toISOString() : undefined,
    pendingRetries: retries.length
  };
}
