import { Receiver } from '../src/Receiver';
import * as moment from 'moment';
import { assert } from 'chai';


const email = 'theowl@etersoft.ru';

describe('Receiver', () => {
  describe('#shouldSendAt', () => {
    it('should always return true with no periodicDate set', () => {
      const receiver = new Receiver(email);
      const date = moment().startOf('year');
      while (date.month() === 0) {
        assert.isOk(receiver.shouldSendAt(date));
        date.add(1, 'days');
      }
    });

    describe('with plain dates', () => { 
      it('should return true when date matches', () => {
        const receiver = new Receiver(email, null, null, '15');
        assert.isOk(receiver.shouldSendAt(moment('15.01.2018', 'DD.MM.YYYY')));
      });

      it('should return false when date mismatches', () => {
        const receiver = new Receiver(email, null, null, '25');
        assert.isNotOk(receiver.shouldSendAt(moment('15.01.2018', 'DD.MM.YYYY')));
      });

      it('should return true when last day of month and periodicDate is higher', () => {
        const receiver = new Receiver(email, null, null, '31');
        assert.isOk(receiver.shouldSendAt(moment('28.02.2018', 'DD.MM.YYYY')));
      });

      it('should return false when last day of month and periodicDate is lower', () => {
        const receiver = new Receiver(email, null, null, '15');
        assert.isNotOk(receiver.shouldSendAt(moment('28.02.2018', 'DD.MM.YYYY')));
      });

      it('should return true when last day of month and periodicDate is equal', () => {
        const receiver = new Receiver(email, null, null, '28');
        assert.isOk(receiver.shouldSendAt(moment('28.02.2018', 'DD.MM.YYYY')));
      });

      describe('with cron-like schedules', () => { 
        it('should return true when date matches', () => {
          const receiver = new Receiver(email, null, null, '15 * *');
          assert.isOk(receiver.shouldSendAt(moment('15.01.2018', 'DD.MM.YYYY')));
        });
  
        it('should return false when date mismatches', () => {
          const receiver = new Receiver(email, null, null, '25 * *');
          assert.isNotOk(receiver.shouldSendAt(moment('15.01.2018', 'DD.MM.YYYY')));
        });
  
        it('should return true when last day of month and some dates are higher', () => {
          const receiver = new Receiver(email, null, null, '31 * *');
          assert.isOk(receiver.shouldSendAt(moment('28.02.2018', 'DD.MM.YYYY')));
        });
  
        it('should return false when last day of month and date is lower', () => {
          const receiver = new Receiver(email, null, null, '15 * *');
          assert.isNotOk(receiver.shouldSendAt(moment('28.02.2018', 'DD.MM.YYYY')));
        });
  
        it('should return true when last day of month and date is equal', () => {
          const receiver = new Receiver(email, null, null, '28 * *');
          assert.isOk(receiver.shouldSendAt(moment('28.02.2018', 'DD.MM.YYYY')));
        });

        it('should return true for complex schedules', () => {
          const receiver = new Receiver(email, null, null, '*/5 * *');
          assert.isOk(receiver.shouldSendAt(moment('16.02.2018', 'DD.MM.YYYY')));
        });

        it('should return false for month mismatch', () => {
          const receiver = new Receiver(email, null, null, '* 3 *');
          assert.isNotOk(receiver.shouldSendAt(moment('16.02.2018', 'DD.MM.YYYY')));
        });

        it('should return false for day of week mismatch', () => {
          const receiver = new Receiver(email, null, null, '16 * 1');
          assert.isNotOk(receiver.shouldSendAt(moment('12.02.2018', 'DD.MM.YYYY')));
        });
      });
    });
  });
});
