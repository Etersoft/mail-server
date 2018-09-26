import { Dispatch } from 'redux';
import { RootState } from '../reducers/index';
import { updateMailing as updateMailingApi } from '../api';
import { notifyAboutError, notifySuccess } from './notify';
import { Mailing } from '../reducers/mailings';
import { MailingEditData } from '../components/MailingDetailView';
import { lockMailing } from './lockMailing';
import { updateMailing } from './updateMailing';
import pick from 'lodash-es/pick';


export function updateMailingOnServer (mailing: Mailing, editData: MailingEditData) {
  return async function (dispatch: Dispatch<RootState>) {
    try {
      dispatch(lockMailing(mailing.id, true));
      await updateMailingApi(mailing.id, pick(editData, [
        'html', 'name', 'subject', 'replyTo', ...(editData.receiversChanged ? ['receivers'] : [])
      ]));
      dispatch(updateMailing(mailing.id, {
        ...editData,
        receiversChanged: false
      }));
      dispatch(notifySuccess('Рассылка изменена.'));
    } catch (error) {
      dispatch(notifyAboutError('Не удалось изменить рассылку.'));
    } finally {
      dispatch(lockMailing(mailing.id, false));
    }
  };
}
