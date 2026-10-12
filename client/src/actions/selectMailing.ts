import { ActionTypes } from '../ActionTypes';
import { loadFullMailingData } from './loadFullMailingData';
import { lockMailing } from './lockMailing';
import { AppDispatch } from '../types';


export function selectMailing (mailingId: number) {
  return async function (dispatch: AppDispatch) {
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
