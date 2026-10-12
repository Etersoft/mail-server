import { ActionTypes } from '../ActionTypes';
import { deleteMailing as deleteMailingFromServer } from '../api';
import { lockMailing } from './lockMailing';
import { notifyAboutError, notifySuccess } from './notify';
import { AppDispatch } from '../types';


export function deleteMailing (id: number) {
  return async function (dispatch: AppDispatch) {
    dispatch(lockMailing(id, true));
    try {
      await deleteMailingFromServer(id);
      dispatch({
        data: id,
        type: ActionTypes.DELETE_MAILING
      });
      dispatch(notifySuccess('Рассылка удалена успешно.'));
    } catch (error) {
      dispatch(lockMailing(id, false));
      dispatch(notifyAboutError('Не удалось удалить рассылку.'));
    }
  };
}
