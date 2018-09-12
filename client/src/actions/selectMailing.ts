import { Mailing } from '../reducers/mailings';
import { Dispatch } from 'react-redux';
import { RootState } from '../reducers/index';
import { ActionTypes } from '../ActionTypes';
import { loadFullMailingData } from './loadFullMailingData';
import { lockMailing } from './lockMailing';


export function selectMailing (mailingId: number) {
  return async function (dispatch: Dispatch<RootState>) {
    try {
      dispatch(lockMailing(mailingId, true));
      await dispatch(loadFullMailingData(mailingId));
      dispatch({
        data: mailingId,
        type: ActionTypes.SELECT_MAILING
      });
    } finally {
      dispatch(lockMailing(mailingId, false));
    }
  };
}
