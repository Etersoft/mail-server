import { Dispatch } from 'redux';
import { RootState } from '../reducers/index';
import { loadReceivers } from './loadReceivers';
import { getMailingById } from '../api';
import { updateMailing } from './updateMailing';


export function loadFullMailingData (id: number) {
  return async function (dispatch: Dispatch<RootState>) {
    const mailing = await getMailingById(id);
    dispatch(updateMailing(id, mailing));
    await dispatch(loadReceivers(mailing.id));
  };
}
