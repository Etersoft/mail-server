import { AddressStatsRepository } from './AddressStatsRepository';
import { Receiver } from './Receiver';
import { isEmail } from 'validator';


const DEFAULT_STATS_BATCH_SIZE = 1000;

export class ReceiverListFilter {
  constructor (
    private statsRepository: AddressStatsRepository
  ) {}
  
  async getValidReceivers (receivers: Receiver[]) {
    const withValidEmails = receivers.filter(receiver => isEmail(receiver.email));
    const failedReceivers: string[] = [];
    for await (const receiversStats of this.getStatsStream(withValidEmails)) { 
      for(const stats of receiversStats) {
        if (stats && stats.lastStatus && stats.lastStatus[0] === '5') {
          failedReceivers.push(stats.email);
        } 
      }
    }
    if(failedReceivers.length) {
      return withValidEmails.filter(r => failedReceivers.indexOf(r.email) < 0);
    } 
    return withValidEmails;
  }

  async *getStatsStream (receivers: Receiver[], batchSize: number = DEFAULT_STATS_BATCH_SIZE) {
    let start = 0;
    let statsBatch: string[];
    while (start < receivers.length) {
      statsBatch = receivers.slice(start, start + batchSize).map(r => r.email);
      yield await this.statsRepository.getBatchStats(statsBatch);
      start+=batchSize;
    };
  }
}