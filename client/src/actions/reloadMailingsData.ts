import { getMailings } from '../api';
import { Dispatch } from 'redux';
import { RootState } from '../reducers';
import { updateMailing } from './updateMailing';
import { addMailing } from './addMailing';


export function reloadMailingsData () {
  return async function (dispatch: Dispatch<RootState>, getState: () => RootState) {
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
        dispatch(addMailing(mailing as any, mailing.id));
      }
    });
  };
}
