import { Dispatch } from 'redux';
import { RootState } from '../reducers/index';
import { createRetryMailing as createRetryMailingOnServer } from '../api';
import { notifyAboutError, notifySuccess } from './notify';
import { Mailing } from '../reducers/mailings';
import { cloneWithApi } from './cloneWithApi';


export function createRetryMailing (mailing: Mailing) {
  return async function (dispatch: Dispatch<RootState>) {
    try {
      if (!mailing.failedReceiversCount) {
        dispatch(notifyAboutError('По этой рассылке нет ошибок доставки.'));
        return;
      }
      await dispatch(cloneWithApi(createRetryMailingOnServer, mailing));
      dispatch(notifySuccess('Рассылка дублирована успешно.'));
    } catch (error) {
      dispatch(notifyAboutError('Не удалось дублировать рассылку.'));
    }
  };
}
