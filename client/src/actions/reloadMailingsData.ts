import { getMailings } from '../api';
import { ActionTypes } from '../ActionTypes';
import { Dispatch } from 'redux';
import { RootState } from '../reducers';
import { updateMailing } from './updateMailing';


export function reloadMailingsData () {
  return async function (dispatch: Dispatch<RootState>) {
    const mailings = await getMailings();
    mailings.forEach(mailing => {
      dispatch(updateMailing(mailing.id, {
        sentCount: mailing.sentCount,
        state: mailing.state
      }));
    });
  };
}
