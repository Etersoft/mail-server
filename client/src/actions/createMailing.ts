import { Dispatch } from 'redux';
import { RootState } from '../reducers/index';
import { MailingCreateData } from '../components/AddForm';
import { createMailing as createMailingOnServer } from '../api';
import { addMailing } from './addMailing';
import { hideAddForm } from './hideAddForm';
import { notifyAboutError, notifySuccess } from './notify';
import { ActionTypes } from 'client/src/ActionTypes';


export function createMailing (mailing: MailingCreateData) {
  return async function (dispatch: Dispatch<RootState>) {
    try {
      const { id, listId } = await createMailingOnServer(mailing);
      dispatch(addMailing(mailing, id, listId));
      dispatch(hideAddForm());
      dispatch({
        data: id,
        type: ActionTypes.SELECT_MAILING
      });
      dispatch(notifySuccess('Рассылка создана успешно.'));
    } catch (error) {
      dispatch(notifyAboutError('Не удалось создать рассылку.'));
    }
  };
}
