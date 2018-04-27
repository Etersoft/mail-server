import { Dispatch } from 'redux';
import { RootState } from '../reducers/index';
import { updateMailing as updateMailingApi } from '../api';
import { notifyAboutError, notifySuccess } from './notify';
import { ActionTypes } from '../ActionTypes';
import { Mailing } from '../reducers/mailings';
import { MailingEditData } from '../components/MailingDetailView';
import { lockMailing } from './lockMailing';
import { updateMailing } from './updateMailing';


export function updateMailingOnServer (mailing: Mailing, editData: MailingEditData) {
  return async function (dispatch: Dispatch<RootState>) {
    try {
      dispatch(lockMailing(mailing.id, true));
      await updateMailingApi(mailing.id, editData);
      dispatch(updateMailing(mailing.id, editData));
      dispatch(notifySuccess('Рассылка изменена.'));
    } catch (error) {
      dispatch(notifyAboutError('Не удалось изменить рассылку.'));
    } finally {
      dispatch(lockMailing(mailing.id, false));
    }
  };
}
