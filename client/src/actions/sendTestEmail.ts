import { Mailing } from '../reducers/mailings';
import { Dispatch } from 'react-redux';
import { RootState } from '../reducers/index';
import { ActionTypes } from '../ActionTypes';
import { loadReceivers } from './loadReceivers';
import { sendTestEmail as sendTestEmailApi } from '../api';
import { notifyAboutError, notifySuccess } from './notify';


export function sendTestEmail (mailing: Mailing, email: string) {
  return async function (dispatch: Dispatch<RootState>) {
    try {
      await sendTestEmailApi(mailing.id, email);
      dispatch(notifySuccess('Тестовое письмо отправлено.'));
    } catch (error) {
      dispatch(notifyAboutError('Не удалось отправить тестовое письмо.'));
    }
  };
}
