import { Mailing } from '../reducers/mailings';
import { Dispatch } from 'react-redux';
import { RootState } from '../reducers/index';
import { ActionTypes } from '../ActionTypes';
import { loadFullMailingData } from './loadFullMailingData';
import { lockMailing } from './lockMailing';


export function selectMailing (mailing: Mailing) {
  return async function (dispatch: Dispatch<RootState>) {
    try {
      dispatch(lockMailing(mailing.id, true));
      await dispatch(loadFullMailingData(mailing.id));
      dispatch({
        data: mailing.id,
        type: ActionTypes.SELECT_MAILING
      });
    } finally {
      dispatch(lockMailing(mailing.id, false));
    }
  };
}
