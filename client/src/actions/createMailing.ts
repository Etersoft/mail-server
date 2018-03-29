import { Dispatch } from 'redux';
import { RootState } from '../reducers/index';
import { MailingCreateData } from '../components/AddForm';
import { createMailing as createMailingOnServer } from '../api';
import { addMailing } from './addMailing';
import { hideAddForm } from './hideAddForm';
import { notifyAboutError } from './notifyAboutError';


export function createMailing (mailing: MailingCreateData) {
  return async function (dispatch: Dispatch<RootState>) {
    dispatch(hideAddForm());
    try {
      const id = await createMailingOnServer(mailing);
      dispatch(addMailing(mailing, id));
    } catch (error) {
      dispatch(notifyAboutError('Не удалось создать рассылку'));
    }
  };
}
