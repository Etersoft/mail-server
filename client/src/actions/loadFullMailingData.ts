import { loadReceivers } from './loadReceivers';
import { getMailingById } from '../api';
import { updateMailing } from './updateMailing';
import { AppDispatch } from '../types';


export function loadFullMailingData (id: number) {
  return async function (dispatch: AppDispatch) {
    const mailing = await getMailingById(id);
    dispatch(updateMailing(id, mailing));
    await dispatch(loadReceivers(mailing.id));
  };
}
