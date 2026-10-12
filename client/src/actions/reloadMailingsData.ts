import { getMailings } from '../api';
import { RootState } from '../reducers';
import { updateMailing } from './updateMailing';
import { addMailing } from './addMailing';
import { AppDispatch } from '../types';


export function reloadMailingsData () {
  return async function (dispatch: AppDispatch, getState: () => RootState) {
    const mailings = await getMailings();
    const state = getState();
    mailings.forEach(mailing => {
      if (state.mailings.byId[mailing.id]) {
        dispatch(updateMailing(mailing.id, {
          sentCount: mailing.sentCount,
          state: mailing.state,
          undeliveredCount: mailing.undeliveredCount
        }));
      } else {
        dispatch(addMailing(mailing as any, mailing.id, mailing.listId));
      }
    });
  };
}
