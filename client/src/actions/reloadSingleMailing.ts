import { getMailingById } from '../api';
import { updateMailing } from './updateMailing';
import { AppDispatch } from '../types';


export function reloadSingleMailing (id: number) {
  return async function (dispatch: AppDispatch) {
    const mailing = await getMailingById(id);
    dispatch(updateMailing(id, {
      sentCount: mailing.sentCount,
      state: mailing.state,
      undeliveredCount: mailing.undeliveredCount
    }));
  };
}
