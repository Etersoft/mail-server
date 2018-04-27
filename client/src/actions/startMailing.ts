import { Mailing } from '../reducers/mailings';
import { Dispatch } from 'redux';
import { RootState } from '../reducers/index';
import { updateMailing as updateMailingOnServer } from '../api';
import { MailingState } from '../../../server/src/Mailing';
import { updateMailing } from './updateMailing';
import { notifyAboutError } from './notify';


export function startMailing (id: number) {
  return async function (dispatch: Dispatch<RootState>) {
    try {
      dispatch(updateMailing(id, {
        locked: true
      }));
      await updateMailingOnServer(id, {
        state: MailingState.RUNNING
      });
      dispatch(updateMailing(id, {
        locked: false,
        state: MailingState.RUNNING
      }));
    } catch (error) {
      dispatch(notifyAboutError('Не удалось запустить рассылку.'));
      dispatch(updateMailing(id, {
        locked: false
      }));
    }
  };
}
