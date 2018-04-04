import { ActionTypes } from '../ActionTypes';
import { Dispatch } from 'redux';
import { RootState } from '../reducers/index';
import { deleteMailing as deleteMailingFromServer } from '../api';
import { notifyAboutError } from './notifyAboutError';
import { lockMailing } from './lockMailing';


export function deleteMailing (id: number) {
  return async function (dispatch: Dispatch<RootState>) {
    dispatch(lockMailing(id, true));
    try {
      await deleteMailingFromServer(id);
      dispatch({
        data: id,
        type: ActionTypes.DELETE_MAILING
      });
    } catch (error) {
      dispatch(lockMailing(id, false));
      dispatch(notifyAboutError(error));
    }
  };
}
