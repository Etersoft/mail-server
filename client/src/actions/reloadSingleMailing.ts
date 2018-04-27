import { getMailingById } from '../api';
import { Dispatch } from 'redux';
import { RootState } from '../reducers';
import { updateMailing } from './updateMailing';


export function reloadSingleMailing (id: number) {
  return async function (dispatch: Dispatch<RootState>) {
    const mailing = await getMailingById(id);
    dispatch(updateMailing(id, {
      sentCount: mailing.sentCount,
      state: mailing.state,
      undeliveredCount: mailing.undeliveredCount
    }));
  };
}
