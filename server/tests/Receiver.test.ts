import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Receiver } from '../src/Receiver';


const email = 'theowl@etersoft.ru';

describe('Receiver', () => {
  describe('#shouldSendAt', () => {
    it('should always return true with no periodicDate set', () => {
      const receiver = new Receiver(email);
      const date = new Date(new Date().getFullYear(), 0, 1);
      while (date.getMonth() === 0) {
        assert.ok(receiver.shouldSendAt(date));
        date.setDate(date.getDate() + 1);
      }
    });

    describe('with plain dates', () => {
      it('should return true when date matches', () => {
        const receiver = new Receiver(email, undefined, undefined, '15');
        assert.ok(receiver.shouldSendAt(new Date(2018, 0, 15)));
      });

      it('should return false when date mismatches', () => {
        const receiver = new Receiver(email, undefined, undefined, '25');
        assert.ok(!receiver.shouldSendAt(new Date(2018, 0, 15)));
      });

      it('should return true when last day of month and periodicDate is higher', () => {
        const receiver = new Receiver(email, undefined, undefined, '31');
        assert.ok(receiver.shouldSendAt(new Date(2018, 1, 28)));
      });

      it('should return false when last day of month and periodicDate is lower', () => {
        const receiver = new Receiver(email, undefined, undefined, '15');
        assert.ok(!receiver.shouldSendAt(new Date(2018, 1, 28)));
      });

      it('should return true when last day of month and periodicDate is equal', () => {
        const receiver = new Receiver(email, undefined, undefined, '28');
        assert.ok(receiver.shouldSendAt(new Date(2018, 1, 28)));
      });

      describe('with cron-like schedules', () => {
        it('should return true when date matches', () => {
          const receiver = new Receiver(email, undefined, undefined, '15 * *');
          assert.ok(receiver.shouldSendAt(new Date(2018, 0, 15)));
        });

        it('should return false when date mismatches', () => {
          const receiver = new Receiver(email, undefined, undefined, '25 * *');
          assert.ok(!receiver.shouldSendAt(new Date(2018, 0, 15)));
        });

        it('should return true when last day of month and some dates are higher', () => {
          const receiver = new Receiver(email, undefined, undefined, '31 * *');
          assert.ok(receiver.shouldSendAt(new Date(2018, 1, 28)));
        });

        it('should return false when last day of month and date is lower', () => {
          const receiver = new Receiver(email, undefined, undefined, '15 * *');
          assert.ok(!receiver.shouldSendAt(new Date(2018, 1, 28)));
        });

        it('should return true when last day of month and date is equal', () => {
          const receiver = new Receiver(email, undefined, undefined, '28 * *');
          assert.ok(receiver.shouldSendAt(new Date(2018, 1, 28)));
        });

        it('should return true for complex schedules', () => {
          const receiver = new Receiver(email, undefined, undefined, '*/5 * *');
          assert.ok(receiver.shouldSendAt(new Date(2018, 1, 16)));
        });

        it('should return false for month mismatch', () => {
          const receiver = new Receiver(email, undefined, undefined, '* 3 *');
          assert.ok(!receiver.shouldSendAt(new Date(2018, 1, 16)));
        });

        it('should return false for day of week mismatch', () => {
          const receiver = new Receiver(email, undefined, undefined, '16 * 1');
          assert.ok(!receiver.shouldSendAt(new Date(2018, 1, 12)));
        });
      });
    });
  });
});
