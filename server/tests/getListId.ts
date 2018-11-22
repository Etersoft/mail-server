// tslint:disable:no-shadowed-variable
import { assert, use } from 'chai';
import 'mocha';
import { useFakeTimers } from 'sinon';
import { getListId } from '../src/getListId';
import { Mailing } from '../src/Mailing';


describe('getListId', () => {
  const fakeConfig = {
    server: {
      mail: {
        listIdDomain: 'testPrefix'
      }
    }
  };
  const fakeMailing = { id: 1 };

  it('should use angle brackets', () => {
    const listId = getListId(fakeConfig, fakeMailing as Mailing);
    assert.equal(listId[0], '<');
    assert.equal(listId[listId.length - 1], '>');
  });

  it('should use current date', () => {
    const now = new Date(2018, 3, 1);
    const timers = useFakeTimers(now);
    try {
      const listId = getListId(fakeConfig, fakeMailing as Mailing).replace(/^<|>$/g, '');
      assert.equal(listId.split('-')[0], `20180401`);
    } finally {
      timers.restore();
    }
  });

  it('should use mailing ID', () => {
    const listId = getListId(fakeConfig, fakeMailing as Mailing).replace(/^<|>$/g, '');
    assert.equal(listId.split('-')[1].split('@')[0], '1');
  });

  it('should use domain from config', () => {
    const listId = getListId(fakeConfig, fakeMailing as Mailing).replace(/^<|>$/g, '');
    assert.equal(listId.split('@')[1], fakeConfig.server.mail.listIdDomain);
  });
});
